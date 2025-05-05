// src/index.ts

// --- Imports ---
import express, { Application, Request, Response, NextFunction } from 'express';
import mysql, { Pool, PoolOptions, RowDataPacket, ResultSetHeader, ConnectionOptions } from 'mysql2/promise';

// --- Interfaces and Types ---

// Define the structure of a Customer object (matching DB table)
interface Customer {
    id: number;
    fname: string;
    lname: string;
    mobile?: string | null; // Optional and can be null from DB
    email?: string | null;  // Optional and can be null from DB
    created_at: Date;       // mysql2 typically returns Date objects for TIMESTAMP
}

// Interface for data coming from the API request body for Create/Update operations
interface CustomerInput {
    fname: string;
    lname: string;
    mobile?: string | null;
    email?: string | null;
}

// More specific type for MySQL errors we might handle
interface MySQLError extends Error {
    code?: string;
    errno?: number;
    sqlState?: string;
}

// Interface for errors handled by the global error handler
interface HttpError extends Error {
    status?: number; // HTTP status code
    code?: string;   // For specific error codes (like DB errors)
    body?: unknown;  // For body-parser syntax errors
}

// --- Express App Initialization ---
const app: Application = express();

// --- Middleware ---
// Use built-in express.json middleware to parse JSON request bodies
app.use(express.json());

// --- Database Configuration ---

const baseDbName: string = process.env.DB_NAME || 'express_api_db';
const nodeEnv: string | undefined = process.env.NODE_ENV;
const isTestMode: boolean = nodeEnv === 'test';
const databaseName: string = isTestMode ? `${baseDbName}_test` : baseDbName;

console.log(`--- Running in ${isTestMode ? 'TEST' : 'NORMAL'} mode ---`);

const dbConfig: PoolOptions = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    // --- IMPORTANT ---
    password: process.env.DB_PASSWORD || '', 
    // --- /IMPORTANT ---
    database: databaseName,
    waitForConnections: true,
    connectionLimit: 10, // Example: Adjust based on expected load
    queueLimit: 0 // Example: No limit on connection queue
};

// Declare pool variable - its type is Pool from mysql2/promise
let pool: Pool;

// --- Database Initialization Function ---
async function initializeDatabase(): Promise<void> {
    try {
        console.log(`Attempting to ensure database: '${dbConfig.database}'`);

        // Config for temporary connection (no specific DB selected)
        const tempDbConfig: ConnectionOptions = { ...dbConfig };
        delete tempDbConfig.database; // Remove database property for initial connection

        const tempConnection = await mysql.createConnection(tempDbConfig);
        await tempConnection.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\`;`);
        await tempConnection.end();
        console.log(`Database '${dbConfig.database}' ensured.`);

        // Create the actual connection pool using the full config
        pool = mysql.createPool(dbConfig);

        // Test the pool connection and ensure the table exists
        const connection = await pool.getConnection();
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
        connection.release(); // Release the connection back to the pool
        console.log(`Table 'customers' ensured in database '${dbConfig.database}'.`);

    } catch (error) {
        console.error(`FATAL: Error initializing database '${dbConfig.database}':`, error);
        process.exit(1); // Exit if DB initialization fails
    }
}

// --- API Routes (Endpoints) ---

// GET all customers
app.get('/customers', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    console.log(`GET /customers received (DB: ${dbConfig.database})`);
    try {
        // Type the result of the query using the Customer interface
        const [rows] = await pool.query<Customer[] & RowDataPacket[]>('SELECT * FROM customers');
        res.status(200).json(rows);
    } catch (error) {
        console.error(`Error fetching customers (DB: ${dbConfig.database}):`, error);
        next(error); // Pass errors to the global handler
    }
});

// GET a single customer by ID
// Use Request generic <ParamsType> to type URL parameters
app.get('/customers/:id', async (req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> => {
    // req.params.id is always a string from the URL, parse it
    const customerId = parseInt(req.params.id, 10);
    console.log(`GET /customers/${customerId} received (DB: ${dbConfig.database})`);

    // Validate the parsed ID
    if (isNaN(customerId)) {
        res.status(400).json({ message: 'Invalid customer ID format' });
        return; // Stop execution after sending response
    }

    try {
        // Query using the parsed numeric ID
        const [rows] = await pool.query<Customer[] & RowDataPacket[]>('SELECT * FROM customers WHERE id = ?', [customerId]);
        if (rows.length === 0) {
            res.status(404).json({ message: 'Customer not found' });
        } else {
            res.status(200).json(rows[0]); // Send the first (and only) row
        }
    } catch (error) {
        console.error(`Error fetching customer ${customerId} (DB: ${dbConfig.database}):`, error);
        next(error);
    }
});

// POST (Create) a new customer
// Use Request generic <ParamsType, ResponseBodyType, RequestBodyType>
app.post('/customers', async (req: Request<{}, { message: string; customerId: number }, CustomerInput>, res: Response, next: NextFunction): Promise<void> => {
    // req.body is now typed as CustomerInput
    const { fname, lname, mobile, email } = req.body;
    console.log(`POST /customers received with body (DB: ${dbConfig.database}):`, req.body);

    // Basic Input Validation
    if (!fname || !lname) {
        res.status(400).json({ message: 'First name (fname) and last name (lname) are required' });
        return;
    }

    try {
        const insertQuery = 'INSERT INTO customers (fname, lname, mobile, email) VALUES (?, ?, ?, ?)';
        // Use ?? null for optional fields to handle undefined/null from request body correctly
        const values = [fname, lname, mobile ?? null, email ?? null];
        // INSERT/UPDATE/DELETE results are typed as ResultSetHeader
        const [result] = await pool.query<ResultSetHeader>(insertQuery, values);

        res.status(201).json({ // 201 Created status
            message: 'Customer created successfully',
            customerId: result.insertId // Get the auto-generated ID from the result
        });
    } catch (error) {
        console.error(`Error creating customer (DB: ${dbConfig.database}):`, error);
        next(error);
    }
});

// PUT (Update) a customer by ID
// Type Params and Request Body
app.put('/customers/:id', async (req: Request<{ id: string }, { message: string }, CustomerInput>, res: Response, next: NextFunction): Promise<void> => {
    const customerId = parseInt(req.params.id, 10);
    // req.body is typed as CustomerInput (though for PUT, sometimes a partial type is used)
    const { fname, lname, mobile, email } = req.body;
    console.log(`PUT /customers/${customerId} received with body (DB: ${dbConfig.database}):`, req.body);

    // Validate parsed ID
    if (isNaN(customerId)) {
        res.status(400).json({ message: 'Invalid customer ID format' });
        return;
    }

    // Basic Input Validation for update data
    if (!fname || !lname) {
        res.status(400).json({ message: 'First name (fname) and last name (lname) are required' });
        return;
    }

    try {
        const updateQuery = 'UPDATE customers SET fname = ?, lname = ?, mobile = ?, email = ? WHERE id = ?';
        const values = [fname, lname, mobile ?? null, email ?? null, customerId];
        const [result] = await pool.query<ResultSetHeader>(updateQuery, values);

        // Check if any row was actually updated
        if (result.affectedRows === 0) {
            res.status(404).json({ message: 'Customer not found or no changes made' });
        } else {
            res.status(200).json({ message: 'Customer updated successfully' });
        }
    } catch (error) {
        console.error(`Error updating customer ${customerId} (DB: ${dbConfig.database}):`, error);
        next(error);
    }
});

// DELETE a customer by ID
// Type Params
app.delete('/customers/:id', async (req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> => {
    const customerId = parseInt(req.params.id, 10);
    console.log(`DELETE /customers/${customerId} received (DB: ${dbConfig.database})`);

    // Validate parsed ID
    if (isNaN(customerId)) {
        res.status(400).json({ message: 'Invalid customer ID format' });
        return;
    }

    try {
        const deleteQuery = 'DELETE FROM customers WHERE id = ?';
        const [result] = await pool.query<ResultSetHeader>(deleteQuery, [customerId]);

        if (result.affectedRows === 0) {
            res.status(404).json({ message: 'Customer not found' });
        } else {
            // Send 200 OK with message or 204 No Content
            res.status(200).json({ message: 'Customer deleted successfully' });
            // Alternatively: res.status(204).send();
        }
    } catch (error) {
        console.error(`Error deleting customer ${customerId} (DB: ${dbConfig.database}):`, error);
        next(error);
    }
});


// --- Global Error Handling Middleware ---
// Use the custom HttpError interface for the 'err' parameter
app.use((err: HttpError, req: Request, res: Response, next: NextFunction): Response | void => {
    console.error("Unhandled Error:", err); // Log the full error

    // Default status and message
    let statusCode: number = err.status ?? 500; // Use error's status if available, else 500
    let responseMessage: string = err.message || 'An internal server error occurred.';
    let details: any = err.stack || err; // Use stack trace or the error itself for details

    // Hide internal details in production
    const isProduction = nodeEnv === 'production';
    if (isProduction) {
        // Keep potentially safe status codes (like 4xx) but use generic messages for 5xx
        if (statusCode >= 500) {
            responseMessage = 'An internal server error occurred.';
        }
        details = undefined; // Don't leak stack trace or raw error details
    }

    // Specific error handling (can be expanded)
    if (err.code === 'ER_DUP_ENTRY') {
        statusCode = 409; // Conflict
        let duplicateField = 'field';
        // Safely check message content
        if (err.message?.includes('email')) duplicateField = 'email';
        else if (err.message?.includes('mobile')) duplicateField = 'mobile';
        responseMessage = `Conflict: Duplicate entry for ${duplicateField}.`;
        // Provide minimal details even in dev for this specific error
        details = isProduction ? undefined : `Duplicate value detected for ${duplicateField}.`;
    } else if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        // Handle JSON parsing errors from express.json()
        statusCode = 400; // Bad Request
        responseMessage = 'Bad Request: Malformed JSON.';
        console.error('Bad JSON received:', err.body);
        details = isProduction ? undefined : err.message; // Only show raw syntax error message in dev
    }

    // Send the final formatted error response
    return res.status(statusCode).json({
        message: responseMessage,
        // Include the 'error' property with details only if 'details' is defined (typically non-production)
        ...(details && { error: details })
    });
});


// --- Start the Server ---
const PORT: number = parseInt(process.env.PORT || '3000', 10);

if (isNaN(PORT)) {
    console.error("Invalid PORT environment variable. Defaulting to 3000.");
    // Defaulting already handled by || '3000', but good to log.
}

initializeDatabase()
    .then(() => {
        // Ensure pool is initialized before starting the listener
        if (!pool) {
            throw new Error("Database pool was not initialized correctly.");
        }
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}, connected to database '${dbConfig.database}'`);
        });
    })
    .catch(error => {
        // Error during initialization is already logged and should cause exit
        console.error("Server did not start due to initialization failure.", error);
        // Ensure exit even if the catch block in initializeDatabase somehow fails
        process.exit(1);
    });