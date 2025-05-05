const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
app.use(express.json());

// --- Database Configuration ---

// Determine the base database name from environment or default
const baseDbName = process.env.DB_NAME || 'express_api_db';

// Check the NODE_ENV environment variable
const isTestMode = process.env.NODE_ENV === 'test';

// Set the actual database name based on the mode
const databaseName = isTestMode ? `${baseDbName}_test` : baseDbName;

console.log(`--- Running in ${isTestMode ? 'TEST' : 'NORMAL'} mode ---`); // Log the mode

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '', // Use env vars for passwords!
    // Use the determined database name
    database: databaseName
};

let pool;

// --- Database Initialization Function ---
async function initializeDatabase() {
    try {
        // Log which database we are attempting to ensure/connect to
        console.log(`Attempting to ensure database: '${dbConfig.database}'`);

        // Create DB if not exists - Requires connection without specific DB initially
        const tempConnection = await mysql.createConnection({
            host: dbConfig.host,
            user: dbConfig.user,
            password: dbConfig.password
        });
        // Use the determined database name here
        await tempConnection.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\`;`);
        await tempConnection.end();
        // Log the specific database ensured
        console.log(`Database '${dbConfig.database}' ensured.`);

        // Create pool for the specific database (regular or test)
        pool = mysql.createPool(dbConfig);

        // Test connection & Ensure table exists in the target database
        const connection = await pool.getConnection();
        // Log connection to the specific database
        console.log(`Successfully connected to the database pool for '${dbConfig.database}'.`);
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS customers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                fname VARCHAR(100) NOT NULL,
                lname VARCHAR(100) NOT NULL,
                mobile VARCHAR(20) UNIQUE,
                email VARCHAR(100) UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;
        await connection.query(createTableQuery);
        connection.release();
        // Log table ensured in the specific database
        console.log(`Table 'customers' ensured in database '${dbConfig.database}'.`);

    } catch (error) {
        console.error(`FATAL: Error initializing database '${dbConfig.database}':`, error);
        process.exit(1);
    }
}

// --- API Routes (Endpoints) ---
// (Your GET, POST, PUT, DELETE routes remain exactly the same as before)
// They will automatically use the 'pool' which is configured for either
// the regular or the test database based on how the server was started.

// GET all customers
app.get('/customers', async (req, res, next) => {
    console.log(`GET /customers received (DB: ${dbConfig.database})`); // Optional: Log DB context
    try {
        const [rows] = await pool.query('SELECT * FROM customers');
        res.status(200).json(rows);
    } catch (error) {
        console.error(`Error fetching customers (DB: ${dbConfig.database}):`, error);
        next(error);
    }
});

// GET a single customer by ID
app.get('/customers/:id', async (req, res, next) => {
    const customerId = req.params.id;
    console.log(`GET /customers/${customerId} received (DB: ${dbConfig.database})`);
    try {
        const [rows] = await pool.query('SELECT * FROM customers WHERE id = ?', [customerId]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Customer not found' });
        }
        res.status(200).json(rows[0]);
    } catch (error) {
        console.error(`Error fetching customer ${customerId} (DB: ${dbConfig.database}):`, error);
        next(error);
    }
});

// POST (Create) a new customer
app.post('/customers', async (req, res, next) => {
    const { fname, lname, mobile, email } = req.body;
    console.log(`POST /customers received with body (DB: ${dbConfig.database}):`, req.body);

    if (!fname || !lname) {
        return res.status(400).json({ message: 'First name (fname) and last name (lname) are required' });
    }

    try {
        const insertQuery = 'INSERT INTO customers (fname, lname, mobile, email) VALUES (?, ?, ?, ?)';
        const values = [fname, lname, mobile ?? null, email ?? null];
        const [result] = await pool.query(insertQuery, values);

        res.status(201).json({
            message: 'Customer created successfully',
            customerId: result.insertId
        });
    } catch (error) {
        console.error(`Error creating customer (DB: ${dbConfig.database}):`, error);
        next(error);
    }
});

// PUT (Update) a customer by ID
app.put('/customers/:id', async (req, res, next) => {
    const customerId = req.params.id;
    const { fname, lname, mobile, email } = req.body;
    console.log(`PUT /customers/${customerId} received with body (DB: ${dbConfig.database}):`, req.body);

    if (!fname || !lname) {
        return res.status(400).json({ message: 'First name (fname) and last name (lname) are required' });
    }

    try {
        const updateQuery = 'UPDATE customers SET fname = ?, lname = ?, mobile = ?, email = ? WHERE id = ?';
        const values = [fname, lname, mobile ?? null, email ?? null, customerId];
        const [result] = await pool.query(updateQuery, values);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Customer not found or no changes made' });
        }
        res.status(200).json({ message: 'Customer updated successfully' });
    } catch (error) {
        console.error(`Error updating customer ${customerId} (DB: ${dbConfig.database}):`, error);
        next(error);
    }
});

// DELETE a customer by ID
app.delete('/customers/:id', async (req, res, next) => {
    const customerId = req.params.id;
    console.log(`DELETE /customers/${customerId} received (DB: ${dbConfig.database})`);
    try {
        const deleteQuery = 'DELETE FROM customers WHERE id = ?';
        const [result] = await pool.query(deleteQuery, [customerId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Customer not found' });
        }
        res.status(200).json({ message: 'Customer deleted successfully' });
    } catch (error) {
        console.error(`Error deleting customer ${customerId} (DB: ${dbConfig.database}):`, error);
        next(error);
    }
});


// --- Global Error Handling Middleware ---
// (This remains the same - it handles errors regardless of which DB was used)
app.use((err, req, res, next) => {
    console.error("Unhandled Error:", err);

    const message = process.env.NODE_ENV === 'production'
        ? 'An internal server error occurred.'
        : err.message || 'An unspecified error occurred.';

    const errorDetails = process.env.NODE_ENV === 'production' ? {} : { error: err.stack || err };

    if (err.code === 'ER_DUP_ENTRY') {
        let duplicateField = 'field';
        if (err.message.includes('email')) duplicateField = 'email';
        else if (err.message.includes('mobile')) duplicateField = 'mobile';
        return res.status(409).json({
             message: `Conflict: Duplicate entry for ${duplicateField}.`,
             details: process.env.NODE_ENV !== 'production' ? err.message : undefined
         });
    }

    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
      console.error('Bad JSON received:', err.body);
      return res.status(400).json({ message: 'Bad Request: Malformed JSON.', details: err.message });
    }

    const status = typeof err.status === 'number' ? err.status : 500;
    res.status(status).json({
        message: message,
        ...errorDetails
    });
});


// --- Start the Server ---
const PORT = process.env.PORT || 3000;

initializeDatabase()
    .then(() => {
        app.listen(PORT, () => {
            // Log which DB the running server is connected to
            console.log(`Server is running on port ${PORT}, connected to database '${dbConfig.database}'`);
        });
    })
    .catch(error => {
        console.error("Server did not start due to database initialization failure.");
    });