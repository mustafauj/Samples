// src/server.ts (or src/index.ts) - Fixed 'delete' operator error

// --- Imports ---
import express, { Application, Request, Response, NextFunction } from 'express';
import mongoose, { Schema, Document, Model, ConnectOptions } from 'mongoose';
import dotenv from 'dotenv';

console.log('[DEBUG] Script starting...');

// --- Load Environment Variables ---
dotenv.config();
console.log('[DEBUG] dotenv configured.');

// --- Interfaces ---
interface CustomerDocument extends Document {
    _id: string | number | mongoose.Types.ObjectId | any;
    [key: string]: any;
}

interface CustomerInput {
    _id: string | number;
    [key: string]: any;
}

interface HttpError extends Error {
    status?: number;
    code?: string;
}

// --- Mongoose Setup ---
const GenericCustomerSchema: Schema<CustomerDocument> = new Schema(
    {
        _id: {
            type: Schema.Types.Mixed,
        }
    },
    {
        strict: false,
        timestamps: true,
        _id: false // Prevent Mongoose default ObjectId _id
    }
);

const CustomerModel: Model<CustomerDocument> = mongoose.model<CustomerDocument>('Customer', GenericCustomerSchema);
console.log('[DEBUG] Generic Customer Mongoose schema (REVISED custom _id handling) and model defined.');

// --- Database Connection Logic (with Test/Normal Mode) ---
const MONGODB_BASE_URI = process.env.MONGODB_BASE_URI;
const MONGODB_DATABASE_NAME_BASE = process.env.MONGODB_DATABASE_NAME;
const nodeEnv: string | undefined = process.env.NODE_ENV;
const isTestMode: boolean = nodeEnv === 'test';

if (!MONGODB_BASE_URI || !MONGODB_DATABASE_NAME_BASE) {
    console.error('FATAL ERROR: MONGODB_BASE_URI or MONGODB_DATABASE_NAME is not defined in .env file.');
    process.exit(1);
}

const databaseName = isTestMode ? `${MONGODB_DATABASE_NAME_BASE}_test` : MONGODB_DATABASE_NAME_BASE;
const MONGODB_URI = `${MONGODB_BASE_URI}/${databaseName}`;

console.log(`[DEBUG] Running in ${isTestMode ? 'TEST' : 'NORMAL'} mode.`);
console.log(`[DEBUG] MONGODB_URI constructed: ${MONGODB_URI}`);

const mongooseOptions: ConnectOptions = {};

console.log('[DEBUG] Attempting to connect to MongoDB...');
mongoose.connect(MONGODB_URI, mongooseOptions)
    .then(() => {
        console.log(`[SUCCESS] Successfully connected to MongoDB: ${databaseName}`);
    })
    .catch(err => {
        console.error('[ERROR] MongoDB initial connection error:', err);
        process.exit(1);
    });

// --- Express App Initialization ---
const app: Application = express();
app.use(express.json());
console.log('[DEBUG] Express app initialized and middleware set.');

// --- API Routes for Customers ---
console.log('[DEBUG] Defining Flexible Customer API routes...');

// POST /customers
app.post('/customers', async (req: Request<{}, {}, CustomerInput>, res: Response, next: NextFunction) => {
    console.log('[ROUTE] POST /customers received with body:', req.body);
    try {
        if (!req.body._id) {
             console.warn('[ROUTE_WARN] POST /customers - Missing required custom _id field');
             return res.status(400).json({ message: 'Validation Error: Custom _id field is required.' });
        }
        const newCustomer = new CustomerModel(req.body);
        const savedCustomer = await newCustomer.save();
        res.status(201).json(savedCustomer);
    } catch (error) {
        console.error('[ROUTE_ERROR] POST /customers:', error);
        if ((error as any).code === 11000 || (error as any).name === 'MongoServerError' && (error as any).code === 11000) {
            return res.status(409).json({ message: `Conflict: Customer with _id '${req.body._id}' already exists.`, error: (error as any).message });
        }
        next(error);
    }
});

// GET /customers
app.get('/customers', async (req: Request, res: Response, next: NextFunction) => {
    console.log('[ROUTE] GET /customers received');
    try {
        const customers = await CustomerModel.find();
        res.status(200).json(customers);
    } catch (error) {
        console.error('[ROUTE_ERROR] GET /customers:', error);
        next(error);
    }
});

// GET /customers/:id
app.get('/customers/:id', async (req: Request<{ id: string | number }>, res: Response, next: NextFunction) => {
    const { id } = req.params;
    console.log(`[ROUTE] GET /customers/${id} received`);
    try {
        const customer = await CustomerModel.findById(id);
        if (!customer) {
            console.warn(`[ROUTE_WARN] GET /customers/${id} - Customer not found`);
            res.status(404).json({ message: 'Customer not found' });
            return;
        }
        res.status(200).json(customer);
    } catch (error) {
        if (error instanceof mongoose.Error.CastError) {
             console.warn(`[ROUTE_WARN] GET /customers/${id} - CastError retrieving customer`, error);
             return res.status(400).json({ message: `Invalid ID format or type mismatch for ID: ${id}` });
        }
        console.error(`[ROUTE_ERROR] GET /customers/${id}:`, error);
        next(error);
    }
});

// PUT /customers/:id
app.put('/customers/:id', async (req: Request<{ id: string | number }, {}, CustomerInput>, res: Response, next: NextFunction) => {
    const { id } = req.params;
    // ** FIX APPLIED HERE: Use destructuring to omit _id instead of delete **
    const { _id, ...updateData } = req.body; // Separate _id from the rest of the data

    console.log(`[ROUTE] PUT /customers/${id} received with body:`, req.body);
    console.log(`[DEBUG] Update data for PUT (without _id):`, updateData); // Log the data being used

    try {
        const updatedCustomer = await CustomerModel.findByIdAndUpdate(id, updateData, { // Use updateData here
            new: true,        // Return the updated document
            overwrite: true,  // Replace the entire document
            // runValidators might be less relevant with strict:false, but keep if needed
        });
        if (!updatedCustomer) {
            console.warn(`[ROUTE_WARN] PUT /customers/${id} - Customer not found for update`);
            res.status(404).json({ message: 'Customer not found' });
            return;
        }
        res.status(200).json(updatedCustomer);
    } catch (error) {
        console.error(`[ROUTE_ERROR] PUT /customers/${id}:`, error);
        if ((error as any).code === 11000 || (error as any).name === 'MongoServerError' && (error as any).code === 11000) {
             return res.status(409).json({ message: 'Conflict: Update would result in a duplicate unique field.', error: (error as any).message });
        }
        next(error);
    }
});

// PATCH /customers/:id
app.patch('/customers/:id', async (req: Request<{ id: string | number }, {}, Partial<CustomerInput>>, res: Response, next: NextFunction) => {
    const { id } = req.params;
    // ** FIX APPLIED HERE: Use destructuring to omit _id instead of delete **
    const { _id, ...patchData } = req.body; // Separate _id from the rest of the data

    console.log(`[ROUTE] PATCH /customers/${id} received with body:`, req.body);
    console.log(`[DEBUG] Patch data for PATCH (without _id):`, patchData); // Log the data being used

    try {
        // Use $set with patchData which doesn't include _id
        const updatedCustomer = await CustomerModel.findByIdAndUpdate(id, { $set: patchData }, {
            new: true, // Return the updated document
            // runValidators: true, // Run validators if you add them to the schema later
        });
        if (!updatedCustomer) {
            console.warn(`[ROUTE_WARN] PATCH /customers/${id} - Customer not found for patch`);
            res.status(404).json({ message: 'Customer not found' });
            return;
        }
        res.status(200).json(updatedCustomer);
    } catch (error) {
        console.error(`[ROUTE_ERROR] PATCH /customers/${id}:`, error);
        if ((error as any).code === 11000 || (error as any).name === 'MongoServerError' && (error as any).code === 11000) {
             return res.status(409).json({ message: 'Conflict: Update would result in a duplicate unique field.', error: (error as any).message });
        }
        next(error);
    }
});

// DELETE /customers/:id
app.delete('/customers/:id', async (req: Request<{ id: string | number }>, res: Response, next: NextFunction) => {
    const { id } = req.params;
    console.log(`[ROUTE] DELETE /customers/${id} received`);
    try {
        const deletedCustomer = await CustomerModel.findByIdAndDelete(id);
        if (!deletedCustomer) {
            console.warn(`[ROUTE_WARN] DELETE /customers/${id} - Customer not found for deletion`);
            res.status(404).json({ message: 'Customer not found' });
            return;
        }
        res.status(200).json({ message: 'Customer deleted successfully', deletedCustomer });
    } catch (error) {
        if (error instanceof mongoose.Error.CastError) {
             console.warn(`[ROUTE_WARN] DELETE /customers/${id} - CastError deleting customer`, error);
             return res.status(400).json({ message: `Invalid ID format or type mismatch for ID: ${id}` });
        }
        console.error(`[ROUTE_ERROR] DELETE /customers/${id}:`, error);
        next(error);
    }
});
console.log('[DEBUG] Flexible Customer API routes defined.');

// --- Global Error Handling Middleware ---
app.use((err: HttpError, req: Request, res: Response, next: NextFunction): void => {
    console.error("[GLOBAL_ERROR_HANDLER] Unhandled API Error:", err.stack || err);

    let statusCode = err.status || 500;
    let responseMessage = err.message || 'An internal server error occurred.';
    const isProduction = process.env.NODE_ENV === 'production';
    let errorDetailsPayload: { error?: any; details?: any } = {};

    if (isProduction) {
        if (statusCode >= 500) responseMessage = 'An internal server error occurred.';
    } else {
        errorDetailsPayload.error = err.stack || err.message;
    }

    if (err.name === 'ValidationError') {
        statusCode = 400;
        responseMessage = 'Validation Error. Please check your input.';
        if (!isProduction) errorDetailsPayload.details = (err as any).errors;
    } else if (err.name === 'CastError') {
        statusCode = 400;
        responseMessage = `Invalid data format or type mismatch for field: ${(err as any).path}.`;
         if (!isProduction) errorDetailsPayload.details = `Value "${(err as any).value}" could not be cast to expected type for path "${(err as any).path}". Kind: ${(err as any).kind}`;
    } else if (err instanceof SyntaxError && err.status === 400 && 'body' in (err as any)) {
        statusCode = 400;
        responseMessage = 'Bad Request: Malformed JSON.';
        if (!isProduction) {
            console.error('[GLOBAL_ERROR_HANDLER] Bad JSON received:', (err as any).body);
            errorDetailsPayload.details = err.message;
        }
    } else if ((err as any).code === 11000 || (err as any).name === 'MongoServerError' && (err as any).code === 11000) {
        statusCode = 409;
        responseMessage = 'Duplicate key error: A record with this unique field already exists.';
        if (!isProduction) errorDetailsPayload.details = (err as any).keyValue || err.message;
    }

    res.status(statusCode).json({
        message: responseMessage,
        ...errorDetailsPayload
    });
});
console.log('[DEBUG] Global error handler defined.');

// --- Server Start ---
const PORT_STRING: string = process.env.PORT || '3001';
const PORT: number = parseInt(PORT_STRING, 10);
console.log(`[DEBUG] PORT configured: ${PORT} from string: "${PORT_STRING}"`);

if (isNaN(PORT)) {
    console.error(`[FATAL_ERROR] Invalid PORT: "${PORT_STRING}". Cannot start server.`);
    process.exit(1);
}

const db = mongoose.connection;
db.on('error', (err) => console.error('[ERROR] Mongoose persistent connection error:', err));
db.once('open', () => {
    console.log('[DEBUG] Mongoose connection "open" event received.');
    app.listen(PORT, () => {
        console.log(`[SUCCESS] Flexible Customer NoSQL API Server is running on port ${PORT}, connected to DB: ${databaseName}`);
    });
});
db.on('disconnected', () => console.warn('[WARN] Mongoose disconnected from MongoDB.'));
db.on('reconnected', () => console.info('[INFO] Mongoose reconnected to MongoDB.'));

console.log('[DEBUG] Script execution reached end (waiting for async ops).');