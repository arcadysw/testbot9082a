const Discord = require("discord.js");
const client = new Discord.Client();
const http = require("http");

/* --- do not edit anything above this line --- */

const prefix = 'cmd';

const MAX_DELAY_GLOBAL_USERS_UPDATE = 10; //second(s)

/* --- do not edit anything below this line --- */

var php_root = process.env.PHP_ROOT;
var php_file = process.env.PHP_FILE;

var myLink = "http://"+php_root+'/'+php_file;

client.on("ready", () => {
	setInterval(function() {
		var request = http.get('http://testbot9082a.herokuapp.com', function(res) {
			console.log("statusCode: ", res.statusCode);
		});
	}, 60000); // every 1 minutes
	
	setInterval(function() {
		client.guilds.forEach( async guild => {
			var thisServerID = guild.id;
			var thisServerName = guild.name;
			
			//update info server
			http.request( myLink+'?subject=server&serverID='+thisServerID+'&action=verify&val='+thisServerName, function(res){}).end();
			
			var now = Math.floor( new Date().getTime() / 1000 );
			
			var USERS = {};
			var counter = 0;
			
			guild.members.forEach(async member => {
				if( !member.user.bot ){
					var thisUser = {};
					thisUser[0] = thisServerID;
					thisUser[1] = member.id;
					thisUser[2] = member.user.discriminator;
					thisUser[3] = Buffer.from(member.user.username).toString('base64');
					thisUser[4] = Buffer.from(member.displayName).toString('base64');
					thisUser[5] = Math.floor( (member.joinedAt).getTime() / 1000);
					
					var lastMsgTimestamp = 0;
					var lastMessage = member.lastMessage;
					if( lastMessage != undefined ){
						lastMsgTimestamp = Math.floor( lastMessage.createdTimestamp / 1000 );
					}
					
					thisUser[6] = lastMsgTimestamp;
					
					var lastVCTimestamp = 0;
					var lastVoiceChannel = member.voiceChannel;
					if( lastVoiceChannel != undefined ){
						lastVoiceChannel = member.voiceChannel.name;
						lastVoiceChannel = Buffer.from(lastVoiceChannel).toString('base64');
						lastVCTimestamp = now;
					}else{
						lastVoiceChannel = null;
					}
					
					thisUser[7] = lastVoiceChannel;
					thisUser[8] = lastVCTimestamp;
					
					var lastStatusActivity = member.user.presence.status;
					var lastStatusTimestamp = 0;
					if( lastStatusActivity != undefined ){
						lastStatusTimestamp = now;
					}else{
						lastStatusActivity = null;
					}
					
					thisUser[9] = lastStatusActivity;
					thisUser[10] = lastStatusTimestamp;
					
					var lastGameActivity = member.user.presence.game;
					var lastGameTimestamp = 0;
					if( lastGameActivity != undefined ){
						lastGameActivity = member.user.presence.game.name;
						lastGameTimestamp = now;
					}else{
						lastGameActivity = null;
					}
					
					thisUser[11] = lastGameActivity;
					thisUser[12] = lastGameTimestamp;
					
					var thisUserRoles = "@everyone";
					member.roles.forEach( async thisRole => {
						if( thisRole.name != "@everyone" ){
							thisUserRoles += "," + thisRole.name;
						}
					});
					thisUserRoles = Buffer.from(thisUserRoles).toString('base64');
					
					thisUser[13] = thisUserRoles;
					
					USERS[counter] = thisUser;
					counter++;
				}
			});
			
			//convert array to json => base64
			var metadata = JSON.stringify(USERS);
			metadata = "metadata="+thisServerID+"@"+Buffer.from(metadata).toString('base64');
			
			var options = {
				hostname: php_root,
				path: '/'+php_file,
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					'Content-Length': metadata.length
				}
			};
			
			//send info to db
			var php_submit = http.request( options, function(subres){});
			php_submit.write( metadata );
			php_submit.end();
			
			console.log( "updating " + thisServerName );
		});
	}, MAX_DELAY_GLOBAL_USERS_UPDATE*1000 );
	
	console.log( 'started' );
});

var ADMINS = {};

client.on("message", async message => {
	if( message.guild == null || message.author.bot ){
		return;
	}
	
	var messageContent = message.content;
	var args = messageContent.split(' ');
	
	if( args[0] !== prefix || args.length < 1 ){
		return;
	}
	
	var thisServerID = message.guild.id;
	var thisServerName = message.guild.name;
	var thisAdmin = message.author.id;
	
	if( !(thisAdmin in ADMINS) ){
		ADMINS[thisServerID] = thisAdmin;
	}
	
	if( ADMINS[thisServerID] != thisAdmin ){
		await message.channel.send( "errore, non sei autorizzato" );
		return;
	}
	
	if( args[1] === "clean" ){
		delete ADMINS[thisServerID]; //reset admin
		await message.channel.send( "admin rimosso" );
	}
	
	if( args[1] === "help" ){
		var help = 'lista comandi:';
		help += '\n\tcmd info <utente> (ottieni informazioni relative all\'utente corrente)';
		help += '\n\tcmd limite_inattivita <valore> (imposta limite inattività massima)';
		help += '\n\tcmd clean (rimuovi admin corrente)';
		await message.channel.send( help );
	}
	
	if( args[1] === "info" ){
		if( args.length > 2 ){
			var displayName = args[2];
			
			if( displayName.length < 3 ){ return; }
			
			//---start get user info by displayName
			http.request( myLink+'?subject=user&serverID='+thisServerID+'&action=get_user_info&displayName='+displayName, function(res){
				let internalBuffer = '';
				res.on( 'data',function(data){ internalBuffer+=data; });
				res.on( 'end',async function(){
					internalBuffer = internalBuffer.replace( /<br>/g,'\n');
					await message.channel.send( internalBuffer );
				});
			}).end();
			//---end get user info by displayName
		}
	}
	
	if( args[1] === "limite_inattivita" ){
		if( args.length > 2 ){
			var maxUserInactivity = 0;
			try{
				maxUserInactivity = parseInt(args[2]);
			}catch(err){
				maxUserInactivity = 15;
			}
			maxUserInactivity *= (3600*24);
			
			//---start set maxUserInactivity
			http.request( myLink+'?subject=server&serverID='+thisServerID+'&action=set&param=maxUserInactivity&val='+maxUserInactivity, function(res){
				let internalBuffer = '';
				res.on( 'data',function(data){ internalBuffer+=data; });
				res.on( 'end',async function(){
					await message.channel.send( internalBuffer );
				});
			}).end();
			//---end set maxUserInactivity
		}
	}
});

client.login(process.env.BOT_TOKEN);
