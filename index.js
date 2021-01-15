const express = require('express');
const app = express();
app.use(express.static('public'));
app.set('view engine', 'ejs')
const fs = require("fs"); //Load the filesystem module
var mysql = require('mysql');
const util = require( 'util' );
var phantom = require("phantom");

const mesi=['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
const colors=['giallo','arancione','arancio','rosso','viola','verde','azzurro','blu','grigio'];
const colcod=['yellow','orange','orange','red','purple','green','cyan','blue','gray'];
var chart_color='red';

var config={
    host     : 'localhost',
    database : 'myrhgoal',
    user     : 'raffa',
    password : 'Raffa1959'
  };  

function makeDb( config ) {
    const connection = mysql.createConnection( config );
    return {
      query( sql, args ) {
        console.log('query '+JSON.stringify(sql));
        console.log('argomenti query '+JSON.stringify(args));
        return util.promisify( connection.query )
          .call( connection, sql, args );
      },
      close() {
        return util.promisify( connection.end ).call( connection );
      }
    };
  }
  
var db = makeDb( config );                

app.get('/', function (req, res) {
    var lista=req.query.lista;
    var tito=req.query.tito;
    console.log("PARAMETRI: "+lista);
    var fname=new Date().getTime()+'.png';
    var fpath=__dirname+"\\public\\plots\\"+fname;
    miaHome=req.headers.host;
    console.log("HEADERS "+JSON.stringify(req.headers));
    if(!lista || !lista.length) {
        return (res.json({'status':0, 'message':'no params'}));
    }
    plotta(fpath,lista,tito).then(function(risu) {
        console.log("FINE");
        res.redirect("/plots/"+fname);
    })
    .catch(function(err) {
        console.log("No plot image generated");
    })
})

app.get('/plot', function (req, res) {
    var lista=req.query.lista;
    var mytito=req.query.tito;
    var mycolo=req.query.colo;
    console.log("PARAMETRI: "+lista+"  TITO="+mytito);
    res.render('plot',{serie:lista,tito:mytito,colo:mycolo});
})

app.get('/ask', function (req, res) {
    var testo=req.query.text;
    var uid=req.query.uid;
    console.log("PARAMETRI: "+testo);
    rispondi(assistant(testo),uid)
    .then((esito) => {
        res.json(esito);
    })
})

function assistant(testo) {
    var stringa='[0-9]+';
    var oggi=new Date();
    var settimana=testo.indexOf('settimana')>=0;
    var scorsa=(settimana && 
    (testo.indexOf('scorsa')>0 || testo.indexOf('passata')>0 
    || testo.indexOf('ultima')>0) ? true : false);    
    var numero=testo.match(stringa);
    var mese=trova(testo,mesi);
    if(numero && mese && settimana) 
        return {'intent':'chart', 'param':lastWeek(new Date('2020/'+mese+'/'+numero),0)};
    if(numero && mese) return {'intent': 'value','param': '2020/'+mese+'/'+numero};
    if(scorsa) return {'intent':'chart', 'param':lastWeek(new Date(),1)};
    if(testo.indexOf("altro ieri") >=0 || testo.indexOf("altroieri")>=0) {
        var altroieri=new Date(oggi.setDate(oggi.getDate()-2));
        return {'intent': 'value','param': altroieri.toISOString().substring(0,10)};
    }
    if(testo.indexOf("ieri") >=0) {
        var ieri=new Date(oggi.setDate(oggi.getDate()-1));
        return {'intent': 'value','param': ieri.toISOString().substring(0,10)};
    }
    var colo=trova(testo,colors);
    if(colo) return {'intent':'colpref','param':colcod[colo-1]};
    return 'boh';
}

function trova(frase,lista) {
    for(var i=0;i<lista.length;i++) 
        if(frase.indexOf(lista[i])>0) return (i+1);
    return null;
}

function lastWeek(dd,coeff) {    
    var offset=dd.getDay()==0 ? 0 : 7*coeff+dd.getDay()-1;
    dd.setDate(dd.getDate()-offset);
    return dd.toISOString().substring(0,10);
}

async function rispondi(intento,uid) {
    try {
        var myqa=[];    
        logga('---------------------------------------');    
        logga('Richiesta da utente: '+uid+', Intento: '+JSON.stringify(intento));
        myqa=myqa=await db.query('select * from tlg_users where tlg_uid=?',[uid]);
        if(!myqa || !myqa.length) {
            return {'type':'text','message':'Non sei abilitato, contatta info@well-mood.net per autorizzazione'};
        }
        if(!intento) return {'type':'text','message':'Scusa, non comprendo'};
        if(intento.intent=='value') {
            logga('Intento: Valore');
            myqa=await db.query('select power from power where date_p=?',[intento.param])
            return {'type':'text','message':'Potenza prodotta in data '+intento.param+': '+myqa[0].power};
        }
        if(intento.intent=='chart') {
            var da=intento.param;
            var ax=new Date(da);
            logga('intento CHART');
            ax.setDate(ax.getDate()+7);
            var a=ax.toISOString().substring(0,10);
            console.log('intervallo '+da+'-'+a);
            myqa=await db.query('select color from preferences where user_id=?',[uid]);
            if(myqa && myqa.length) chart_color=myqa[0].color;
            myqa=await db.query('select power from power where date_p>=? and date_p<=?',[da,a]);
            var fname=new Date().getTime()+'.png';
            var fpath=__dirname+"\\public\\plots\\"+fname;
            var tito='Settimana del '+da;
            var lista=[];
            for(var item of myqa) lista.push(item.power);
            await plotta(fpath,lista,tito);
            return {'type':'picture','path':'http://www.oksteve.info/plots/'+fname}
        }
        if(intento.intent=='colpref') {
            logga('Intento: Colore');
            myqa=await db.query('select color from preferences where user_id=?',[uid]);
            if(!myqa || !myqa.length) {
                console.log('NESSUN COLORE SETTATO, INSERISCO');
                await db.query('insert into preferences(user_id,color) values(?,?)',[uid,intento.param]);
            }
            else {
                console.log('COLORE TROVATO: '+myqa[0].color+', CAMBIO IN '+intento.param);
                await db.query('update preferences set color=? where user_id=?',[intento.param,uid]);
            }
            return {'type':'text','message':'Colore preferito: '+intento.param};
        }
        logga('Intento: BOH');
        return {'type':'text','message':'work in progress'};
    }
    catch(erro) {
        logga("ERRORE... "+erro);
        return {'type':'text','message':JSON.stringify(erro)}
    }
}

function plotta(fpath,myserie,tito)
{
    return new Promise(function(resolve, reject) {
        console.log("OUPUT FILE "+fpath);
        console.log("MY SERIE "+myserie)
        phantom.create().then(function (ph) {
            ph.createPage().then(function (page) {
                console.log("PAGE CREATED");
                var myurl="http://localhost/plot?lista="+myserie+"&colo="+chart_color+"&tito="+tito
                console.log('Calling page '+myurl);
                page.open(myurl)
                .then(function(status) {
                    console.log("PAGINA APERTA");
                    page.render(fpath).
                    then(function() {
                        console.log("FILE IMMAGINE CREATO");
                        page.close().then(function(x) {
                            ph.exit();    
                            resolve('ok');
                        })                        
                    })
                    .catch(function(err) {
                        console.log("errore render "+err);
                        reject(err);
                    })
                })
                .catch(function(erro) {
                    console.log("Erorr opening page "+erro);
                    reject(erro);
                })                           
            })
            .catch(function(erro) {
                console.log("Error in setting page content "+erro);
                reject(erro);
            });
        });
    });
}

function zero(num) {
    if(num.length==1) return '0'+num;
    else return num;
}

function getLogFile() {
    const oggi=new Date();
    const logDate=oggi.getFullYear().toString()+zero((oggi.getMonth()+1).toString())+
      zero(oggi.getDate().toString());
    return './logs/'+logDate+'.log';
}

function logga(string) {
    var logFile=getLogFile();
//    console.log('LOGGA - logfile='+logFile);
    var adesso=new Date();
    var logora=zero(adesso.getHours().toString())+':'+zero(adesso.getMinutes().toString());
    try {
        fs.appendFileSync(logFile,logora+';'+string+'\n');
    }
    catch(erro) {
        fs.appendFileSync(logFile,logora+';errore '+erro+'\n');
    }
}

// Start lisening to http port
app.listen(80, function () {
    console.log('plot listening on port 80!')
})