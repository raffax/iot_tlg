var mysql  = require('mysql');
const util = require( 'util' );

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
db.query('select color from preferences where user_id=?',['259637854'])
.then((myqa) => {
    console.log(JSON.stringify(myqa));
    db.close().then((x) => {
      console.log('Finito');
    })
})
.catch((erro) => {
  console.log('Errore '+erro);
})
