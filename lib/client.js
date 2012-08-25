var socket=io.connect();
//Game p
gaminginfo.on("new",function(game){
	socket.on("init",function(obj){
		//再描画フラグ
		var redraw_flg=true;

		var env=obj.env;
		console.log(env);
		game.user._id=obj.user_id;
		game.objectsmap[obj.user_id]=game.user;
		//現在の状況すべて
		//console.log(JSON.stringify(env));
		game.objects.length=0;
		for(var i=0,l=env.length;i<l;i++){
			//ひとつずつ追加
			executeJSON(game,env[i]);
		}

		//全部
		socket.on("events",function(arr){
			//console.log("events",arr.map(function(x){return x.name}));
			redraw_flg=false;
			for(var i=0,l=arr.length;i<l;i++){
				socket.$emit(arr[i].name,arr[i].obj);
			}
			redraw_flg=true;
			game.view.event.emit("rerender");
		});
		//メッセージを受け取りはじめる
		socket.on("add",function(obj){
			//新しいオブジェクトが追加された
			//クライアント側に追加する
			//console.log(window[obj.constructorName]);
			//console.log("add",obj.constructorName);
			var o=game._old_add(window[obj.constructorName],executeJSON(game,obj.param),true);
			o._id=obj._id;
			//入れる
			game.objectsmap[o._id]=o;
			//なんとまだinitしていない
			o._constructor.call(o,game,o.event,o._param,game.view);
			if(o.init)o.init(game,o.event,o._param,game.view);
			//viewへ
			if(redraw_flg){
				game.view.event.emit("rerender");
			}
		});
		socket.on("die",function(_id){
			//オブジェクトを削除する
			//console.log("dyyyyy!",_id,game.objectsmap[_id]);
			if(!game.objectsmap[_id])return;
			game._eraceObject(game.objectsmap[_id]);
			delete game.objectsmap[_id];
			//viewへ
			if(redraw_flg){
				game.view.event.emit("rerender");
			}
		});
		socket.on("clean",function(){
			game.clean();
			if(redraw_flg){
				game.view.event.emit("rerender");
			}
		});
		socket.on("event",function(obj){
			//イベントがきた
			var o=game.objectsmap[obj._id];
			//console.log("event!",obj.name,obj,o.event.listeners(obj.name));
			if(!o)return;
			o.event.emit.apply(o.event,[obj.name].concat(executeJSON(game,obj.args)));
		});
		socket.on("gameevent",function(obj){
			//イベントがきた
			game.event._old_emit.apply(game.event,[obj.name].concat(executeJSON(game,obj.args)));
		});
		socket.on("userevent",function(obj){
			var u=game.objectsmap[obj._id];
			if(!u)return;
			u.event.emit.apply(u.event,[obj.name].concat(executeJSON(game,obj.args)));
		});
		socket.on("env",function(arr){
			for(var i=0,l=arr.length;i<l;i++){
				var o=arr[i];
				if(o.$type==="obj"){
					var u=game.objectsmap[o._id];
					if(u){
						setProperties(u,o.properties);
					}
				}
			}
		});
		socket.emit("initok");
		game.view.event.emit("rerender");
	});

});
//Game override for client
Game.prototype.internal_init=function(){
	//無効
	this.event._old_emit=this.event.emit;
	this.event.emit=function(){};

};
Game.prototype.start=function(){
	//サーバーへユーザーを送る
	var opt=_g_option;
	var game=this;
	//debugger;
	this.user=this.newUser(opt);
	this.user.init(this,opt);
	if(this.userfunc)this.userfunc(this.user);
	//ユーザーに細工する
	var old_emit=this.user.event.emit;
	this.user.event.emit=function(name){
		var args=Array.prototype.slice.call(arguments,1);
		if(name==="newListener")return;
		socket.emit("userevent",{
			name:name,
			args:JSONFilter(args),
		});
		//old_emit.apply(user.event,arguments);
	};
	var sessionid = localStorage.sessionid || void 0;
	//sessionidが発行されるまで待つ
	if(socket.socket.sessionid){
		connection();
	}else{
		socket.once("connect",function(){
			connection();
		});
	}
	function connection(){
		game.entry(game.user,opt);
		//console.log(sessionid,"→",socket.socket.sessionid);
		socket.emit("entry",sessionid,opt);
		localStorage.sessionid=socket.socket.sessionid;	//新しいやつに変える
	}
};
Game.prototype._old_add=Game.prototype.add;
//クライアント側からは追加できない
Game.prototype.add=function(){
	//ダミーを返す
	return {
		event:new EventEmitter,
	};
};
//ユーザーに細工する
Game.prototype.newUser=function(){
	var user=new (this.defaultUser)();
	
	return user;
};
Game.prototype.initObject=function(d){
	//イベントを制限 die無効
	d.event.removeAllListeners("internal");
};
//internalでないので実行しない
Game.prototype.internal=function(){};
Game.prototype.env="client";

/*function ClientManager(game){
	Game.Manager.apply(this,arguments);
}
ClientManager.prototype=Game.util.extend(Game.Manager,{
});*/


//向こうの特殊形式を戻す
function executeJSON(game,obj){
	if(typeof obj!=="object" || !obj)return obj;
	if(obj.$type=="user"){
		//ユーザーオブジェクト
		//var user=game.newUser();
		var user;
		//console.log("user!",obj._id,game.user._id);
		if(obj._id==game.user._id){
			//自分だ
			user=game.user;
			delete obj.properties.event;	//それはいらん
		}else{
			user=game.newUser();
			user.internal=false;
			user._id=obj._id;
			user.init(game);
			game.objectsmap[obj._id]=user;
		}
		//console.log(obj._id,obj.properties);
		delete obj.properties.internal;
		setProperties(user,executeJSON(game,obj.properties));
		return user;
	}else if(obj.$type=="EventEmitter"){
		return new EventEmitter;
	}else if(obj.$type=="obj"){
		//何か
		//console.log(obj._id,obj.constructorName);
		//debugger;
		//既存のオブジェクトかどうかチェック
		for(var i=0,l=game.objects.length;i<l;i++){
			//既にある
			if(game.objects[i]._id==obj._id){
				return game.objects[i];
			}
		}
		if(!obj.constructorName){
			//存在しないオブジェクトが来た

		}
		var constructor=window[obj.constructorName];
		if(!constructor)throw new Error(obj.constructorName);
		if(!obj.properties)return null;
		//var o=game._old_add(constructor,executeJSON(game,obj._param));
		var o=game._old_add(constructor,{},true);
		//先に入れる
		o._id=obj._id;
		game.objectsmap[obj._id]=o;
		//! 要整理!!
		//なんとまだinitしていない
		//o._constructor.call(o,game,o.event,o._param,game.view);
		//現在のパラメータ反映
		setProperties(o,obj.properties);
		if(o.init)o.init(game,o.event,o._param,game.view);
		return o;
	}else if(Array.isArray(obj)){
		return obj.map(function(x){return executeJSON(game,x)});
	}else{
		//ただのオブジェクト
		var ret={};
		for(var key in obj){
			ret[key]=executeJSON(game,obj[key]);
		}
		return ret;
	}

}
function setProperties(obj,map){
	if(!obj)return; 
	for(var key in map){
		var value=map[key];
		obj[key]=executeJSON(game,value);
	}
}

//簡易的にオブジェクト送信機構
function JSONFilter(obj){
	if("object"!==typeof obj || !obj){
		return obj;
	}
	if(Array.isArray(obj)){
		return obj.map(function(x){return JSONFilter(x)});
	}else if(obj._constructor){
		//special object!
		return {$type:"object",_id:obj._id};
	}
	return obj;
}
