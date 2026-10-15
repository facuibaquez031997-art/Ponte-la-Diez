const express = require ('express');
const app = express();
const PORT = 3000;
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();
app.use(express.json());

app.use(cors());

app.get('/', (req, res) => {
    res.send("servidor corriendo");
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en: http://localhost:${PORT}`);
});

// const nombre = 'facundo';
// const hora = new Date().getHours();

// if(hora < 12){
//     console.log(`buen dia, ${nombre}`)
// } else {
//     console.log(`buenas tardes, ${nombre}`)
// }

// console.log('node version:', process.version)
// console.log('estoy en:', __dirname)
// console.log(`la hora es:`, hora);

// const precios = [1200,800,3000];
// let total = 0;

// for(const p of precios) total +=p;
// console.log(`total: $${total}`);

// const {A} = {a:7, b:2};
// console.log(JSON.stringify({A}));