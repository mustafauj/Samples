"use strict";
// src/server.ts (or src/index.ts) - Fixed 'delete' operator error
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// --- Imports ---
const express_1 = __importDefault(require("express"));
const mongoose_1 = __importStar(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
console.log('[DEBUG] Script starting...');
// --- Load Environment Variables ---
dotenv_1.default.config();
console.log('[DEBUG] dotenv configured.');
// --- Mongoose Setup ---
const GenericCustomerSchema = new mongoose_1.Schema({
    _id: {
        type: mongoose_1.Schema.Types.Mixed,
    }
}, {
    strict: false,
    timestamps: true,
    _id: false // Prevent Mongoose default ObjectId _id
});
const CustomerModel = mongoose_1.default.model('Customer', GenericCustomerSchema);
console.log('[DEBUG] Generic Customer Mongoose schema (REVISED custom _id handling) and model defined.');
// --- Database Connection Logic (with Test/Normal Mode) ---
const MONGODB_BASE_URI = process.env.MONGODB_BASE_URI;
const MONGODB_DATABASE_NAME_BASE = process.env.MONGODB_DATABASE_NAME;
const nodeEnv = process.env.NODE_ENV;
const isTestMode = nodeEnv === 'test';
if (!MONGODB_BASE_URI || !MONGODB_DATABASE_NAME_BASE) {
    console.error('FATAL ERROR: MONGODB_BASE_URI or MONGODB_DATABASE_NAME is not defined in .env file.');
    process.exit(1);
}
const databaseName = isTestMode ? `${MONGODB_DATABASE_NAME_BASE}_test` : MONGODB_DATABASE_NAME_BASE;
const MONGODB_URI = `${MONGODB_BASE_URI}/${databaseName}`;
console.log(`[DEBUG] Running in ${isTestMode ? 'TEST' : 'NORMAL'} mode.`);
console.log(`[DEBUG] MONGODB_URI constructed: ${MONGODB_URI}`);
const mongooseOptions = {};
console.log('[DEBUG] Attempting to connect to MongoDB...');
mongoose_1.default.connect(MONGODB_URI, mongooseOptions)
    .then(() => {
    console.log(`[SUCCESS] Successfully connected to MongoDB: ${databaseName}`);
})
    .catch(err => {
    console.error('[ERROR] MongoDB initial connection error:', err);
    process.exit(1);
});
// --- Express App Initialization ---
const app = (0, express_1.default)();
app.use(express_1.default.json());
console.log('[DEBUG] Express app initialized and middleware set.');
// --- API Routes for Customers ---
console.log('[DEBUG] Defining Flexible Customer API routes...');
// POST /customers
app.post('/customers', (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('[ROUTE] POST /customers received with body:', req.body);
    try {
        if (!req.body._id) {
            console.warn('[ROUTE_WARN] POST /customers - Missing required custom _id field');
            return res.status(400).json({ message: 'Validation Error: Custom _id field is required.' });
        }
        const newCustomer = new CustomerModel(req.body);
        const savedCustomer = yield newCustomer.save();
        res.status(201).json(savedCustomer);
    }
    catch (error) {
        console.error('[ROUTE_ERROR] POST /customers:', error);
        if (error.code === 11000 || error.name === 'MongoServerError' && error.code === 11000) {
            return res.status(409).json({ message: `Conflict: Customer with _id '${req.body._id}' already exists.`, error: error.message });
        }
        next(error);
    }
}));
// GET /customers
app.get('/customers', (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('[ROUTE] GET /customers received');
    try {
        const customers = yield CustomerModel.find();
        res.status(200).json(customers);
    }
    catch (error) {
        console.error('[ROUTE_ERROR] GET /customers:', error);
        next(error);
    }
}));
// GET /customers/:id
app.get('/customers/:id', (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    console.log(`[ROUTE] GET /customers/${id} received`);
    try {
        const customer = yield CustomerModel.findById(id);
        if (!customer) {
            console.warn(`[ROUTE_WARN] GET /customers/${id} - Customer not found`);
            res.status(404).json({ message: 'Customer not found' });
            return;
        }
        res.status(200).json(customer);
    }
    catch (error) {
        if (error instanceof mongoose_1.default.Error.CastError) {
            console.warn(`[ROUTE_WARN] GET /customers/${id} - CastError retrieving customer`, error);
            return res.status(400).json({ message: `Invalid ID format or type mismatch for ID: ${id}` });
        }
        console.error(`[ROUTE_ERROR] GET /customers/${id}:`, error);
        next(error);
    }
}));
// PUT /customers/:id
app.put('/customers/:id', (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    // ** FIX APPLIED HERE: Use destructuring to omit _id instead of delete **
    const _a = req.body, { _id } = _a, updateData = __rest(_a, ["_id"]); // Separate _id from the rest of the data
    console.log(`[ROUTE] PUT /customers/${id} received with body:`, req.body);
    console.log(`[DEBUG] Update data for PUT (without _id):`, updateData); // Log the data being used
    try {
        const updatedCustomer = yield CustomerModel.findByIdAndUpdate(id, updateData, {
            new: true, // Return the updated document
            overwrite: true, // Replace the entire document
            // runValidators might be less relevant with strict:false, but keep if needed
        });
        if (!updatedCustomer) {
            console.warn(`[ROUTE_WARN] PUT /customers/${id} - Customer not found for update`);
            res.status(404).json({ message: 'Customer not found' });
            return;
        }
        res.status(200).json(updatedCustomer);
    }
    catch (error) {
        console.error(`[ROUTE_ERROR] PUT /customers/${id}:`, error);
        if (error.code === 11000 || error.name === 'MongoServerError' && error.code === 11000) {
            return res.status(409).json({ message: 'Conflict: Update would result in a duplicate unique field.', error: error.message });
        }
        next(error);
    }
}));
// PATCH /customers/:id
app.patch('/customers/:id', (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    // ** FIX APPLIED HERE: Use destructuring to omit _id instead of delete **
    const _a = req.body, { _id } = _a, patchData = __rest(_a, ["_id"]); // Separate _id from the rest of the data
    console.log(`[ROUTE] PATCH /customers/${id} received with body:`, req.body);
    console.log(`[DEBUG] Patch data for PATCH (without _id):`, patchData); // Log the data being used
    try {
        // Use $set with patchData which doesn't include _id
        const updatedCustomer = yield CustomerModel.findByIdAndUpdate(id, { $set: patchData }, {
            new: true, // Return the updated document
            // runValidators: true, // Run validators if you add them to the schema later
        });
        if (!updatedCustomer) {
            console.warn(`[ROUTE_WARN] PATCH /customers/${id} - Customer not found for patch`);
            res.status(404).json({ message: 'Customer not found' });
            return;
        }
        res.status(200).json(updatedCustomer);
    }
    catch (error) {
        console.error(`[ROUTE_ERROR] PATCH /customers/${id}:`, error);
        if (error.code === 11000 || error.name === 'MongoServerError' && error.code === 11000) {
            return res.status(409).json({ message: 'Conflict: Update would result in a duplicate unique field.', error: error.message });
        }
        next(error);
    }
}));
// DELETE /customers/:id
app.delete('/customers/:id', (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    console.log(`[ROUTE] DELETE /customers/${id} received`);
    try {
        const deletedCustomer = yield CustomerModel.findByIdAndDelete(id);
        if (!deletedCustomer) {
            console.warn(`[ROUTE_WARN] DELETE /customers/${id} - Customer not found for deletion`);
            res.status(404).json({ message: 'Customer not found' });
            return;
        }
        res.status(200).json({ message: 'Customer deleted successfully', deletedCustomer });
    }
    catch (error) {
        if (error instanceof mongoose_1.default.Error.CastError) {
            console.warn(`[ROUTE_WARN] DELETE /customers/${id} - CastError deleting customer`, error);
            return res.status(400).json({ message: `Invalid ID format or type mismatch for ID: ${id}` });
        }
        console.error(`[ROUTE_ERROR] DELETE /customers/${id}:`, error);
        next(error);
    }
}));
console.log('[DEBUG] Flexible Customer API routes defined.');
// --- Global Error Handling Middleware ---
app.use((err, req, res, next) => {
    console.error("[GLOBAL_ERROR_HANDLER] Unhandled API Error:", err.stack || err);
    let statusCode = err.status || 500;
    let responseMessage = err.message || 'An internal server error occurred.';
    const isProduction = process.env.NODE_ENV === 'production';
    let errorDetailsPayload = {};
    if (isProduction) {
        if (statusCode >= 500)
            responseMessage = 'An internal server error occurred.';
    }
    else {
        errorDetailsPayload.error = err.stack || err.message;
    }
    if (err.name === 'ValidationError') {
        statusCode = 400;
        responseMessage = 'Validation Error. Please check your input.';
        if (!isProduction)
            errorDetailsPayload.details = err.errors;
    }
    else if (err.name === 'CastError') {
        statusCode = 400;
        responseMessage = `Invalid data format or type mismatch for field: ${err.path}.`;
        if (!isProduction)
            errorDetailsPayload.details = `Value "${err.value}" could not be cast to expected type for path "${err.path}". Kind: ${err.kind}`;
    }
    else if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        statusCode = 400;
        responseMessage = 'Bad Request: Malformed JSON.';
        if (!isProduction) {
            console.error('[GLOBAL_ERROR_HANDLER] Bad JSON received:', err.body);
            errorDetailsPayload.details = err.message;
        }
    }
    else if (err.code === 11000 || err.name === 'MongoServerError' && err.code === 11000) {
        statusCode = 409;
        responseMessage = 'Duplicate key error: A record with this unique field already exists.';
        if (!isProduction)
            errorDetailsPayload.details = err.keyValue || err.message;
    }
    res.status(statusCode).json(Object.assign({ message: responseMessage }, errorDetailsPayload));
});
console.log('[DEBUG] Global error handler defined.');
// --- Server Start ---
const PORT_STRING = process.env.PORT || '3001';
const PORT = parseInt(PORT_STRING, 10);
console.log(`[DEBUG] PORT configured: ${PORT} from string: "${PORT_STRING}"`);
if (isNaN(PORT)) {
    console.error(`[FATAL_ERROR] Invalid PORT: "${PORT_STRING}". Cannot start server.`);
    process.exit(1);
}
const db = mongoose_1.default.connection;
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
//# sourceMappingURL=index.js.map