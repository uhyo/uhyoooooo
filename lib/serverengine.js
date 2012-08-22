var EventEmitter=require('events').EventEmitter;
Game.prototype.internal_init=function(){
	this.event._old_emit=this.event.emit;
	var game=this;
	this.event.emit=function(name){
		var args=Array.prototype.slice.call(arguments,1);
		this._old_emit.apply(this,[name].concat(args));
		//特殊なイベントは除外する
		if(name==="loop" || name==="newListener" ||  name==="entry" || name==="gamestart")return;
		game.transport.gameevent(name,args);
	};
	//ループ
	this.event.on("loopstart",function(){
		//トランスポーターを変える
		game.transporter=ServerLoopTransporter;
		game.transport=game.getTransporter();
	});
	//ユーザーをとっておく
	this.sessionUsers={};	//sessionidがキー
	/* {
	   user:(user)
	   expire:(number)[s]
	   timerid:(id) ? null
	   } */
};
Game.prototype.init=function(view,viewparam){
	//It's dummy!
	this.view=new ServerView(this,view);
	/*this.view=new view(this,viewparam);
	this.view.server=true;*/
	this.view.init(viewparam);
};
Game.prototype.start=function(){
	//何もしない
	this.event.emit("gamestart");
};
Game.prototype._old_newUser=Game.prototype.newUser;
Game.prototype.newUser=function(option,event){
	//新しいユーザー（サーバー用）
	//var user=this._old_newUser();
	var game=this;
	var user=new (this.defaultUser)();
	//ユーザーに対してIDを付加
	Object.defineProperty(user,"_id",{
		value:this.uniqueId()
	});
	//ここでサーバー用に（中身なし）
	user.internal=false;
	//サーバー用メソッドを搭載する
	ServerUser.prototype.init.call(user,option);

	//----------------
	user.event=event;
	event._old_emit=event.emit;
	event.emit=function(name){
		var args=Array.prototype.slice.call(arguments,1);
		this._old_emit.apply(this,[name].concat(args));
		//全員へ
		game.transport.userevent(user,name,args);
	};
	return user;
};
//オブジェクトを追加
/*Game.prototype._old_add=Game.prototype.add;
Game.prototype.add=function(constructor,param){
	var obj=this._old_add.apply(this,arguments);
	return obj;
};*/
Game.prototype._old_initObject=Game.prototype.initObject;
Game.prototype.initObject=function(d){
	//ユニークIDをあげる
	var ev=d.event;
	var game=this;
	ev._old_emit=ev.emit;
	ev.emit=function(name){
		var args=Array.prototype.slice.call(arguments,1);
		this._old_emit.apply(this,[name].concat(args));
		if(name!="internal" && name!="loop" && name!="die"){
			game.transport.event(d,name,args);
		}
	};
	this._old_initObject(d);
};
Game.prototype.getObjectEmitter=function(obj){
	return new EventEmitter();
};
//ソケットで発信
Game.prototype.broadcast=function(name,obj){
	//name: メッセージ名 obj:内容
	this.gaminginfo.emit("broadcast",name,obj);
};
//JSONでコンストラクタ情報などを送るsystem
/*
	$type:"obj"/"user"
	properties:{
	}
*/
//flag: 詳細フラグ（2:完全 1:このオブジェクトのみ詳細 0:詳細なし)
//objectmap: 既にオブジェクト化したものは除く(WeakMapがいいか?)
Game.prototype.jsonFilter=function(obj,flag,objectmap){
	if(!objectmap)objectmap={};
	//console.log(obj);
	//if(obj._constructor)console.log("filter!",obj._constructor.name);
	if(typeof obj !=="object")return obj;
	if(!obj)return obj;
	var result={};
	var t=this;
	if(Array.isArray(obj)){
		return obj.map(function(x){return t.jsonFilter(x,flag,objectmap)});
	}else if(obj instanceof Game.User){
		return {
			$type:"user",
			properties:this.propertiesJSON(obj,0,objectmap),
			_id:obj._id,
		};
	}else if(obj instanceof EventEmitter){
		return {
			$type:"EventEmitter",
		};
	}else if(!obj._constructor){
		//普通のオブジェクトだ
		return this.propertiesJSON(obj,0,objectmap);
	}else{
		// 特殊オブジェクトだ
		if(objectmap[obj._id]){
			//既にオブジェクト化した（無限再帰防止）
			flag=0;
		}
		objectmap[obj._id]=true;
		if(flag){
			var mode= flag===2?2:0;
			return {
				$type:"obj",
				constructorName:obj._constructor.name,
				properties:this.propertiesJSON(obj,mode,objectmap),
				//_param:this.propertiesJSON(obj._param || {},mode,objectmap),
				_id:obj._id,
			};
		}else{
			return {
				$type:"obj",
				_id:obj._id,
			};
		}
	}
	for(var key in obj){
		var value=obj[key];
		if(typeof value !=="object"){
			result[key]=value;
		}else if(value){
		}
	}
	return result;
};
Game.prototype.propertiesJSON=function(obj,flag,objectmap){
	var keys=Object.keys(obj);
	var result={};
	for(var i=0,l=keys.length;i<l;i++){
		var k=keys[i];
		result[k]=this.jsonFilter(obj[k],flag,objectmap);
	}
	return result;
};
//現在の状況を作る（JSON化される前提で）
Game.prototype.wholeEnvironment=function(user){
	/*var result=[];
	for(var i=0,os=this.objects,l=os.length;i<l;i++){
		var obj=os[i];
		result.push({
			constructorName:obj._constructor.name,
			properties:this.propertiesJSON(obj),
		});
	}
	//できた
	console.log(result);
	return result;*/
	if(user){
		return this.jsonFilter(this.objects.filter(function(x){
			return !x._private || x._private===user;
		}),2);
	}else{
		return this.jsonFilter(this.objects.filter(function(x){
			return !x._private;
		}),2);
	}
};

//そのユーザーのセッションを保存
Game.prototype.session=function(user,option){
	if(!option)option={};
	var sessionid=user._socket.id;
	var expire = isNaN(option.expire) ? 600 : option.expire-0;
	this.sessionUsers[sessionid]={
		user:user,
		expire:expire,
		timerid:null,
	};
	//console.log("session!",sessionid);
	//console.log(this.sessionUsers);
};
Game.prototype.unsession=function(user){
	var obj=this.sessionUsers[user._socket.id];
	if(obj && obj.timerid){
		//その場で切れる
		clearTimeout(obj.timerid);
	}
	delete this.sessionUsers[user._socket.id];
	if(user.alive && user._socket.disconnected){
		//戻ってこない
		user.alive=false;
		user.event.emit("disconnect");
		this.byeUser(user);
	}
};
Game.prototype.env="server";
function ServerView(game,view){
	Game.View.apply(this);
	//viewの中身をからっぽにする
	var dummy=new view(game);
	for(var key in dummy){
		if(typeof dummy[key]==="function"){
			this[key]=function(){};
		}
	}
}
ServerView.prototype=Game.util.extend(Game.View,{
});
function ServerUser(){
	Game.User.apply(this);
}
ServerUser.prototype=Game.util.extend(Game.User,{
});

function ServerTransporter(game,gaminginfo){
	this.game=game;
	this.gaminginfo=gaminginfo;
	//イベントをまとめる
	this.store=[];
	this.tick_tack_toe=false;	//イベントを送ったか
}
ServerTransporter.prototype={
	/*broadcast:function(name,obj){
		this.gaminginfo.emit("broadcast",name,obj);
	},*/
	broadcast:function(name,obj){
		this.store.push({
			name:name,
			obj:obj,
		});
		if(!this.tick_tack_toe){
			//イベントを送らないといけない
			var t=this;
			process.nextTick(function(){
				t.scatterEvent();
				t.tick_tack_toe=false;
			});
			this.tick_tack_toe=true;
		}
	},
	touser:function(user,name,obj){
		if(!user._socket)return;
		this.gaminginfo.emit("private",user._socket,name,obj);
	},
	add:function(obj){
		var o={
			constructorName:obj._constructor.name,
			_id:obj._id,
			param:this.game.jsonFilter(obj._param,true),
		};
		if(obj._private){
			//ユーザープライベートなオブジェクトである
			this.touser(obj._private,"add",o);
		}else{
			this.broadcast("add",o);
		}
	},
	die:function(obj){
		//console.log("die!",obj._id,obj._constructor.name);
		this.broadcast("die",obj._id);
	},
	clean:function(obj){
		this.broadcast("clean");
	},
	event:function(obj,name,args){
		if(name==="newListener")return;
		this.broadcast("event",{
			_id:obj._id,
			name:name,
			args:this.game.jsonFilter(args,false),
		});
	},
	gameevent:function(name,args){
		this.broadcast("gameevent",{
			name:name,
			args:this.game.jsonFilter(args,false),
		});
	},
	userevent:function(user,name,args){
		this.broadcast("userevent",{
			_id:user._id,
			name:name,
			args:args,
		});
	},
	loop:function(){},
	//イベントを実際に送る
	scatterEvent:function(){
		//放出
		var l;
		if((l=this.store.length)>1){
			this.gaminginfo.emit("broadcast","events",this.store);
		}else if(l){
			this.gaminginfo.emit("broadcast",this.store[0].name,this.store[0].obj);
		}
		this.store.length=0;
	},
};
function ServerLoopTransporter(){
	ServerTransporter.apply(this,arguments);
	this.count=this.wait=this.game.config.fps*this.game.config.adjust;	//5秒に1回かな・・・
}
ServerLoopTransporter.prototype=Game.util.extend(ServerTransporter,{
	broadcast:function(name,obj){
		this.store.push({
			name:name,
			obj:obj,
		});
	},
	loop:function(){
		this.scatterEvent();
		if(--this.count===0){
			//調整してあげる
			this.gaminginfo.emit("volatile","env",this.game.wholeEnvironment());
			this.count=this.wait;
		}
	},
});
Game.prototype.transporter=ServerTransporter;
