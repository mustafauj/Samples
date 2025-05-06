"use strict";
// src/index.ts (or src/server.ts - your main TypeScript file for this project)
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Import Express and its types
const express_1 = __importDefault(require("express"));
// Note: NextFunction is imported but not used in this simple example.
// It's good practice to include it if you might add error handling or more complex middleware later.
// Create an Express application instance, explicitly typed
const app = (0, express_1.default)();
// Middleware to parse JSON request bodies
app.use(express_1.default.json());
// --- Define Routes ---
// GET /getp
app.get('/getp', (req, res) => {
    console.log('GET /getp received');
    res.status(200).json({ message: 'GET is working successfully' });
});
// POST /postp
// req.body is typed as 'any' for simplicity in this test API.
// For a real app, you'd define an interface for the expected request body.
app.post('/postp', (req, res) => {
    console.log('POST /postp received with body:', req.body);
    res.status(201).json({
        message: 'POST is working successfully',
        received_data: req.body
    });
});
// PUT /putp
app.put('/putp', (req, res) => {
    console.log('PUT /putp received with body:', req.body);
    res.status(200).json({
        message: 'PUT is working successfully',
        received_data: req.body
    });
});
// DELETE /deletep
app.delete('/deletep', (req, res) => {
    console.log('DELETE /deletep received');
    res.status(200).json({ message: 'DELETE is working successfully' });
});
// --- Server Start ---
// Define the port, parsing from environment variable or defaulting
const PORT_STRING = process.env.PORT || '3000';
const PORT = parseInt(PORT_STRING, 10);
// Check if parsing resulted in a valid number
if (isNaN(PORT)) {
    console.error(`Invalid PORT environment variable: "${PORT_STRING}". Defaulting to 3000.`);
    // Note: The default to 3000 is already handled by '|| 3000',
    // but this log provides more context if process.env.PORT was an invalid string.
    // Re-assign if needed, though the || '3000' handles it:
    // PORT = 3000;
}
// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
//# sourceMappingURL=index.js.map