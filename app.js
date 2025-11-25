const express = require('express');
const Blockchain = require('./blockchain/blockchain');

const app = express();
const dlt = new Blockchain();

// Make the blockchain instance available to all routes
app.set('blockchain', dlt);

// Middlewares - needed for POST requests
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// A simple root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'Welcome to the DLT API!',
        nodeAddress: dlt.nodeAddress
    });
});

// Core endpoint to expose the blockchain data
app.get('/blockchain', (req, res) => {
    res.send(dlt);
});

// Registering the routes
app.use('/transactions', require('./routes/transactions'));
app.use('/mine', require('./routes/mine'));
app.use('/nodes', require('./routes/nodes'));
app.use('/histories', require('./routes/histories'));

module.exports = app;
