/* ----------------------------------------------------
connessione con Telegram
-------------------------------------------------------*/
const request=require('request');

var risu= { statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body:             
                {status: {code: 200, message: "no params"}}
        };
var telegram_url='';
var telegram_furl='';
const params={
    'TELEGRAM_BOT': "846567027:AAG9xv2rOQrTcUSfJCYHbZgDEIGehEvwxIA",    
}

function main(message) {
    if(!message) return risu;
    telegram_url='https://api.telegram.org/bot'+params.TELEGRAM_BOT;
    telegram_furl='https://api.telegram.org/file/bot'+params.TELEGRAM_BOT+'/';

    return new Promise((resolve,reject) => {
        var messaggio=message;
        var telefono=null;
        console.log("ARRIVATO messaggio "+JSON.stringify(messaggio,null,4));
        if(messaggio.contact && messaggio.contact.phone_number) {
            console.log("Arrivato telefono");
            telefono=messaggio.contact.phone_number;
        }
//---------------------------------------------------
// Verifico se l'utente e' autenticato
//---------------------------------------------------
		var corpo=null;
		rispondi(messaggio,telefono)
		.then((risposta) => {
            risu.body.message="OK";
            resolve(risu);
		})
		.catch((erro) => {
		    risu.body.message="Errore tlg "+JSON.stringify(erro,null,4);
		    resolve(risu);
		})
	})
}

/*-----------------------------------------------------------------------------------------
Rispondi
-----------------------------------------------------------------------------------------*/
async function rispondi(messaggio, telefono) {
    var invio=null;
    try {
        utente='xxxx';        
//-------------------------------------------------------------------------------
// Verifico se c'è un messaggio vocale
//--------------------------------------------------------------------
        if(messaggio.voice) {
            messaggio.text=await sttVoiceFile(messaggio.voice);
        }
//        var esito={"testo": messaggio.text};

        var esito= await requestp({
            'method':'GET',
            'url':'http://smartpipe.westeurope.cloudapp.azure.com/ask?uid='+messaggio.chat.id+'&text='+messaggio.text
        });        
        console.log('Da server MS ottengo '+esito);
        if(typeof esito == "string") esito=JSON.parse(esito);
        if(esito.type=='picture') {
            console.log('Invio foto a telegram');
            var invio=await requestp({
                'url':telegram_url+'/sendPhoto', method:'POST',
                'json': {'chat_id':messaggio.chat.id,'photo':esito.path}
            });
            console.log('SendPhoto ritorna '+JSON.stringify(invio));
            return true;
        }
        else {
            var myText=esito.message.replace(/<br\/>/g,'\n');
            myText=myText.replace(/<p>/g,'\n');
            myText=myText.replace(/<\/p>/g,'');
            myText=myText.replace(/<s>/g,'');
            myText=myText.replace(/<\/s>/g,'\n');
            invio=await requestp({'url':telegram_url+'/sendMessage', method:'POST',
            'json': {'chat_id':messaggio.chat.id,'text':myText}})
            return true;
        }
	}
	catch(erro) {
		return "Errore controlla_user "+JSON.stringify(erro);
	}
}

async function controlla_user(messaggio,telefono) {
    try {
        console.log("Entro in controlla_user");
        var utente=null, corpo=null;
        if(telefono) {
            if(telefono.indexOf('39')==0) telefono=telefono.substring(2);
            if(telefono.indexOf('+39')==0) telefono=telefono.substring(3);
            utente=null;
            if(utente && utente.docs && utente.docs.length) {
                var newProf=utente.docs[0];
                newProf.telegram={'id':messaggio.chat.id};
                await dbuser.insert(newProf);
                return {'utente':newProf};
            }
            else return {'chat_id': messaggio.chat.id,'text': 'Non sei ancora iscritto al portale OkSteve'}
        }
        else {
            utente=null;
	    	if(!utente || !utente.docs || !utente.docs.length) {  // non sono collegato
    			console.log("Utente non conosciuto...");
	    		var rispo="Per parlare con me devi essere iscritto al portale OkSteve (http://www.oksteve.cloud). "+
                "Se sei già iscritto al portale, schiaccia il bottone di verifica";
                corpo={'chat_id': messaggio.chat.id,'text': rispo};
                corpo.reply_markup = {
                    'keyboard' : [ [ {'text':'Registrazione', 'request_contact': true} ]],
                    'one_time_keyboard':true,
                    'resize_keyboard': true
		        };
                return corpo;
            }
        }
        return {'utente':utente};
    }
    catch(erro) {
        console.log("Errore controllo user "+JSON.stringify(erro,null,4));
        return {'chat_id': messaggio.chat.id,'text': "Errore controllo utente"};
    }
}

/*-----------------------------------------------------------------------------
Get file audio and translate it
-------------------------------------------------------------------------------*/
async function sttVoiceFile(voice) {
    var contenuto=null;
    var oggFile='./t_voice.ogg';
    return new Promise(async function(resolve) {
        try {
            if(!voice || !voice.file_id) resolve(null);
            file_id=voice.file_id;
            var getfile=await requestp({'method':'post','url':telegram_url+'/getFile','json': {"file_id":file_id}});
            console.log("got file "+JSON.stringify(getfile,null,4));
            var initFile=telegram_furl+getfile.result.file_path;
            request(initFile).pipe(fs.createWriteStream(oggFile))
            .on('finish', async function() {
                console.log('scaricato...');
                var oggStream=fs.createReadStream(oggFile);
                var esito= await requestp({
                    'method':'POST',
                    'url':'https://eastus.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=it-IT',
                    'headers': {"Ocp-Apim-Subscription-Key": "faf9b762ec49484282cc38205901a5a2",
                    'Content-type': 'audio/ogg; codecs=opus'},
                    'body':oggStream
                });
                console.log('dopo request '+esito);
                if(typeof esito == "string") esito=JSON.parse(esito);
                if(esito && esito.RecognitionStatus=='Success') {
                    console.log('TESTO: '+esito.DisplayText);
                    contenuto=esito.DisplayText;                    
                }
                resolve(contenuto);
            })
        }
        catch(erro) {
            console.log("Error "+erro);
            resolve(erro);
        }    
    })
}

async function requestp(args) {
    return new Promise((resolve,reject) => {
      console.log("requestp args: "+JSON.stringify(args,null,4));
      request(args,function(err,res,body) {
          if(err) reject(err)
          else resolve(body);
        })
    })
  }
