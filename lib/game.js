//node-game
var ev=require('events'), path=require('path'), socketio=require('socket.io'), http=require('http'), url=require('url'), fs=require('fs');
var gameengine=require('./engine.js');
//サーバー用差分
var Game=gameengine.Game;
global.Game=Game;
require('./serverengine.js');

//サーバー作動
exports.Server=function(srv){
	ev.EventEmitter.call(this);
	//srv: http server?
	this.server=srv;
	this.routeOptions={};
	this.serves=[];
	this.generator=new RespGenerator(this);
};
exports.createServer=function(srv){
	if(!srv)srv=80;	//default portnumber
	if("number"===typeof srv){
		//port number!
		srv=(function(num){
			var r=http.createServer();
			r.listen(num);
			return r;
		})(srv);
	}
	var app= new exports.Server(srv);
	return app;
};
exports.Server.prototype=Game.util.extend(ev.EventEmitter,{
	io:function(cb){
		cb(socketio);
	},
	init:function(gamefile,options){
		//サーバー起動
		this.options=options;
		this.initServer(options);
		//ゲームパス
		if(!Array.isArray(gamefile)){
			//配列に変換
			gamefile=[gamefile];
		}
		this.gamefile=gamefile.map(function(p){return path.join(path.dirname(require.main.filename),p);});
		this.generator.init(this.gamefile,function(tmpfile){
			//ゲーム起動
			require(tmpfile);
		}.bind(this));
	},
	serve:function(type,filename){
		//サーブするファイルを追加
		this.serves.push({type:type,filename:path.join(path.dirname(require.main.filename),filename)});
	},
	route:function(name,func){
		this.routeOptions[name]=func;
	},
	initServer:function(options){
		//init server
		//設定
		this.encoding = options.encoding || "utf-8";
		var t=this;
		//var app=this.app=express.createServer();
		//もともとあったlistenerを保存しておく
		var l=this.server.listeners('request');
		this.defaultListeners=l.concat([]);
		this.server.removeAllListeners('request');
		this.server.on("request",this.handleRequest.bind(this));

		var io=socketio.listen(this.server);
		io.set('log level',1);
		this.initSocket(io);
	},
	//リクエストハンドラ
	handleRequest:function(req,res){
		var p=url.parse(req.url);
		var split=p.pathname.split("/");
		//スクリプトをserve
		/*if(split[1]==="script"){
			var filename;
			var type="application/javascript";
			switch(split[2]){
				case 'EventEmitter.min.js':
					filename='../module/EventEmitter.min.js';
					break;
				case 'engine.js':
					filename='./engine.js';
					break;
				case 'game.js':
					filename=this.gamefile;
					break;
				case 'client.js':
					filename='./client.js';
					break;
				case 'route.js':
					res.set('Content-Type','application/javascript');
					res.send("_g_routes="+JSON.stringify(t.routeOptions));
					return;
			}
			var f=path.resolve(module.filename,"..",filename);
			fs.readFile(f,this.encoding,function(err,data){
				if(err){
					res.writeHead(404,{
						"Content-Type":"text/plain",
					});
					res.end('404: '+split[2]);
					return;
				}
				//serve
				res.writeHead(200,{
					"Content-Type":type+"; charset="+this.encoding,
				});
				res.end(data,this.encoding);
			});
			return;
		}*/
		if(split[1]==="uhyoooooo"){
			//uhyoooooo scripts
			if(split[2]==="uhyoooooo.js"){
				res.writeHead(200,{
					"Content-Type":"text/javascript; charset="+this.encoding,
				});
				res.end(this.generator.serveScripts());
				return;
			}
		}else if(split[1]==="serve"){
			//static file
			if(isNaN(split[2])){
				//そんなものはない
				res.writeHead(404,{
					"Content-Type":"text/plain",
				});
				res.end('404');
				return;
			}
			fs.readFile(path.resolve(__dirname,this.serves[split[2]].filename),this.encoding,function(err,data){
				if(err){
					res.writeHead(404,{
						"Content-Type":"text/plain",
					});
					res.end('404: '+split[2]);
					return;
				}
				//serve
				res.writeHead(200);
				res.end(data,this.encoding);
			});
			return;
		}
		//ページ
		var mode=split[1];
		if(!mode)mode="";
		var option=this.routeOptions[mode];
		if(option){
			// serveすべき
			//CSSの番号
			var csss=this.serves.filter(function(x){return x.type==="css"}).map(function(x,i){return i});
			/*res.render('index',{
			  servedir:"/serve",
			  csss:csss,
			  scriptsdir:"/script",
			  title:options.title,
			  scripts:[
			  "EventEmitter.min.js",
			  "engine.js",
			  "client.js",
			  "route.js",
			  "game.js"],
			  });*/
			return;
		}
		res.serveClient=this._res_serveClient.bind(this,res);
		//通常のリスナに渡す
		for(var i=0,l=this.defaultListeners.length;i<l;i++){
			//console.log("listen!", this.defaultListeners[i].toString());
			this.defaultListeners[i].call(this.server,req,res);
		}
	},
	//clientをサーブするやつ
	_res_serveClient:function(res,option){
		if(!option)option={};
		//HTMLを生成する
		var html=this.generator.serveClient(option);
		res.writeHeader(200,{
			"Content-Type":"text/html; charset="+this.encoding,
		});
		res.end(html);
	},
	initSocket:function(io){
		var gaminginfo=gameengine.gaminginfo;

		gaminginfo.on("new",function(game){
			//新しいインスタンスができた
			//ゲーム用
			gaminginfo.on("broadcast",function(name,obj){
				//console.dir(obj);
				io.sockets.emit(name,obj);
			});
			gaminginfo.on("private",function(socket,name,obj){
				socket.emit(name,obj);
			});
			gaminginfo.on("volatile",function(name,obj){
				io.sockets.volatile.emit(name,obj);
			});
			io.sockets.on("connection",function(socket){
				//ユーザーの襲来
				//ユーザー入力のイベント
				var user;
				var event=new EventEmitter();
				socket.on("disconnect",function(){
					//切断された
					//セッションに残っているかどうか確かめる
					if(user){
						var sess=game.sessionUsers[socket.id];
						if(!sess){
							//戻る可能性はない
							dyingUser(user,socket);
						}else{
							//戻る可能性があるので有効期限のカウントダウン
							var sessionid=socket.id;
							if(sess.timerid){
								clearTimeout(sess.timerid);
							}
							sess.timerid=setTimeout(function(){
								delete game.sessionUsers[sessionid];
								if(user.alive && user._socket.disconnected){
									//戻ってこない
									dyingUser(user,socket);
								}
							},sess.expire*1000);
						}
					}
				});
				socket.on("entry",function(sessionid,option){
					//console.log(sessionid,game.sessionUsers);
					// ユーザーを教えてあげる
					//（サーバー側用ユーザーオブジェクト作成）
					var stranger=true;	//新しい人か（entryする）
					var sass;
					if(sessionid && (sass=game.sessionUsers[sessionid])){
						//あのユーザーだ
						user=sass.user;
						//要整理? disconnect回避のために一時的にfalse
						user.alive=false;
						game.unsession(user);
						user.alive=true;
						delete event;
						event=user.event;
						stranger=false;
					}else{
						user=game.newUser(option,event);
					}
					//ここでユーザーに現在の状況を教える
					var env=game.wholeEnvironment(user);
					//ユーザーとソケットを結びつける
					Object.defineProperty(user,"_socket",{
						value:socket,
						configurable:true,
					});
					if(!stranger){
						//新しいソケットでセッション保存
						game.session(user,{
							expire:sass.expire,
						});
					}
					socket.on("initok",function(){
						//game.event.emit("entry",user);
						if(stranger){
							//新しい人が来ました
							game.entry(user,option);
						}
						game._users.push(user);
						socket.removeAllListeners("initok");
					});
					socket.emit("init",{
						env:env,
						user_id:user._id,
					});
				});
				//クライアント側で起きたイベント
				socket.on("userevent",function(obj){
					if(!obj || !obj.args || !user)return;	//!user: まだユーザーが確立していない(一部イベントを破棄してしまう?)
					//_old_emit: serverengine.jsで定義
					event._old_emit.apply(event,[obj.name].concat(expJSON(game,obj.args)));
				});
				//動く
				if(game.loopController){
					game.loopController.start();
				}
				//ユーザーが完全にいなくなったときの処理
				function dyingUser(user,socket){
					if(user){
						user.alive=false;
						user.event.emit("disconnect");
						game.byeUser(user);
					}
				}
			});
		});

	},
});
//usereventのマークアップを復元
function expJSON(game,obj){
	if(!obj)return obj;
	if(obj.$type==="object"){
		return game.objectsmap[obj._id];
	}else if(Array.isArray(obj)){
		return obj.map(function(x){return expJSON(game,x)});
	}
	return obj;
}
//HTMLを生成する
function RespGenerator(server){
	this.server=server;
	this.tempfilename=".tmp";
	//clientスクリプトをpackする
	this.clientScript="";
}
RespGenerator.prototype={
	init:function(gamefile,callback){
		//初期化 gamefile: [フルパス?]
		//callback: tmpfileのパスを渡してあげよう
		this.packScripts(gamefile,callback);
	},
	packScripts:function(gamefile,callback){
		//結合するファイル
		var files=["engine.js","client.js"];
		function loadone(index,files,callback,result){
			if(!result)result="";
			var filename=files[index];
			if(!filename){
				//終了
				callback(result);
				return;
			}

			fs.readFile(path.resolve(path.dirname(module.filename),filename),"utf8",function(err,data){
				if(err){
					console.error(err);
					callback(null);
					return;
				}
				//読み込めた
				result+=data;	//追加
				loadone(index+1,files,callback,result);
			});
		}
		loadone(0,gamefile,function(result){
			//ゲームスクリプトを1つにまとめた。保存する
			var tempfilename=this.tempfilename;
			(function t(index,callback){
				fs.exists("./"+tempfilename+index,function(res){
					if(res){
						//ある
						t(index+1,callback);
					}else{
						callback(index);
					}
				});
			})(0,function(index){
				//このインデックスに保存する
				var tmpfile=path.join(path.dirname(require.main.filename),"./"+tempfilename+index);
				fs.writeFileSync(tmpfile,result);
				loadone(0,files.concat(tmpfile),function(result){
					//全部まとめる
					this.clientScript=result;
					callback(tmpfile);	//ファイルをあげる
					//短い命
					fs.unlinkSync(tmpfile);
				}.bind(this));
			}.bind(this));
		}.bind(this));
	},
	serveClient:function(option){
		var srv=this.server;
		//HTMLを生成
		var head1="<!doctype html>\n<html><head><meta charset='"+srv.encoding+"'><title>"+srv.options.title+"</title><script type='text/javascript' src='/socket.io/socket.io.js'></script><script type='text/javascript'>var _g_option="+JSON.stringify(option)+";</script><script type='text/javascript' src='/uhyoooooo/uhyoooooo.js'></script>";
		//ここでcssを送る
		var csss=srv.serves.filter(function(x){return x.type==="css"}).map(function(x,i){return i});
		var head2="";
		for(var i=0,l=csss.length;i<l;i++){
			head2+="<link rel='stylesheet' href='/serve/"+csss[i]+"'>";
		}
		var body1="</head><body></body></html>";
		return head1+head2+body1;
	},
	serveScripts:function(){
		return this.clientScript;
	},
};
