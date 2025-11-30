"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
const app = (0, express_1.default)();
dotenv_1.default.config({
    path: path_1.default.resolve("./src/config/.env"),
});
const routes_1 = __importDefault(require("./routes"));
const db_connection_1 = require("./DB/db.connection");
const Errors_1 = require("./utils/Errors");
const cors_1 = __importDefault(require("cors"));
const express_rate_limit_1 = require("express-rate-limit");
var whitelist = ["http://example1.com", "http://example2.com", "http://127.0.0.1:5501", undefined];
var corsOptions = {
    origin: function (origin, callback) {
        console.log("Origin:", origin);
        if (whitelist.indexOf(origin) !== -1) {
            callback(null, true);
        }
        else {
            callback(new Errors_1.ApplicationException("Not allowed by CORS", 401));
        }
    },
};
const limiter = (0, express_rate_limit_1.rateLimit)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 100,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    ipv6Subnet: 56,
});
const bootstrap = async () => {
    await (0, db_connection_1.connectDB)();
    app.use((0, cors_1.default)(corsOptions));
    app.use(limiter);
    app.use(express_1.default.json());
    app.use("/api/v1", routes_1.default);
    app.use((err, req, res, next) => {
        res.status(err.statusCode || 500).json({
            errMsg: err.message,
            status: err.statusCode || 500,
            stack: err.stack,
        });
    });
    app.use((req, res) => {
        res.status(404).json({
            errMsg: "Route Not Found",
            status: 404,
        });
    });
    const httpServer = app.listen(process.env.PORT, () => {
        console.log("Backend server is running on port", process.env.PORT);
        console.log("=========================================");
    });
};
exports.default = bootstrap;
