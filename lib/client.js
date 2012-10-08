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
			game.executeJSON(env[i]);
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
			//console.log("add!",obj);
			//新しいオブジェクトが追加された
			//クライアント側に追加する
			//console.log(window[obj.constructorName]);
			//console.log("add",obj.constructorName);
			var o=game._old_add(window[obj.constructorName],game.executeJSON(obj.param),true);
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
			//console.log("event!",obj);
			var o=game.objectsmap[obj._id];
			//console.log("event!",obj.name,obj,o.event.listeners(obj.name));
			if(!o)return;
			o.event.emit.apply(o.event,[obj.name].concat(game.executeJSON(obj.args)));
		});
		socket.on("gameevent",function(obj){
			//イベントがきた
			game.event._old_emit.apply(game.event,[obj.name].concat(game.executeJSON(obj.args)));
		});
		socket.on("userevent",function(obj){
			var u=game.objectsmap[obj._id];
			if(!u)return;
			u.event.emit.apply(u.event,[obj.name].concat(game.executeJSON(obj.args)));
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
	var opt= "undefined"===typeof _g_option ? {} : _g_option || {};
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
			args:game.jsonFilter(args),
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


