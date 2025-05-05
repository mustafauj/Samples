const express = require('express');
const app = express();

app.use(express.json());

app.get('/getp', (req, res) => {
    console.log('GET /getp received');
    res.status(200).json({ message: 'GET is working successfully' });
});

app.post('/postp', (req, res) => {
    console.log('POST /postp received with body:', req.body); 
    res.status(201).json({
        message: 'POST is working successfully',
        received_data: req.body
    });
});

app.put('/putp', (req, res) => {
    console.log('PUT /putp received with body:', req.body); 
    res.status(200).json({
        message: 'PUT is working successfully',
        received_data: req.body
    });
});

app.delete('/deletep', (req, res) => {
    console.log('DELETE /deletep received');
    res.status(200).json({ message: 'DELETE is working successfully' });
    
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
