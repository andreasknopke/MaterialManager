import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import cabinetRoutes from './routes/cabinet.routes';
import materialRoutes from './routes/material.routes';
import productRoutes from './routes/product.routes';
import categoryRoutes from './routes/category.routes';
import companyRoutes from './routes/company.routes';
import barcodeRoutes from './routes/barcode.routes';
import fieldConfigRoutes from './routes/fieldConfig.routes';
import adminRoutes from './routes/admin.routes';
import unitRoutes from './routes/unit.routes';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import statisticsRoutes from './routes/statistics.routes';
import shapeRoutes from './routes/shape.routes';
import interventionRoutes from './routes/intervention.routes';
import reorderRoutes from './routes/reorder.routes';
import auditLogRoutes from './routes/auditLog.routes';
import aiRoutes from './routes/ai.routes';
import { extractDbToken } from './middleware/dbToken';

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3001;

// Optional: Frontend ausliefern (für Coolify 1-Service Deployment)
// Wird nur aktiviert, wenn ein Frontend-Build vorhanden ist.
const frontendBuildPath = path.resolve(__dirname, '..', 'frontend-build');
if (fs.existsSync(frontendBuildPath)) {
  console.log(`📁 Frontend wird statisch ausgeliefert aus: ${frontendBuildPath}`);
  app.use(express.static(frontendBuildPath, {
    index: false,
    setHeaders: (res, filePath) => {
      if (filePath.includes(`${path.sep}static${path.sep}`)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    }
  }));
}

// Middleware
const allowedOrigins = [
  'http://localhost:3000',
  'https://robust-vision-production.up.railway.app',
  'https://materialmanager-production.up.railway.app'
];

app.use(cors({
  origin: (origin, callback) => {
    // Erlaube Requests ohne Origin (z.B. mobile apps, curl)
    if (!origin) return callback(null, true);
    
    // Wenn CORS_ORIGIN='*' gesetzt ist, erlaube alles
    if (process.env.CORS_ORIGIN === '*') return callback(null, true);
    
    // Wenn CORS_ORIGIN gesetzt ist, nutze nur diese
    if (process.env.CORS_ORIGIN) {
      return callback(null, process.env.CORS_ORIGIN);
    }
    
    // Ansonsten prüfe erlaubte Origins
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// DB Token Middleware - Extrahiert X-DB-Token Header
app.use(extractDbToken);

// Logging Middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/cabinets', cabinetRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/barcodes', barcodeRoutes);
app.use('/api/field-configs', fieldConfigRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/units', unitRoutes);
app.use('/api/statistics', statisticsRoutes);
app.use('/api/shapes', shapeRoutes);
app.use('/api/interventions', interventionRoutes);
app.use('/api/reorder', reorderRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/ai', aiRoutes);

// Health Check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Config Endpoint - gibt Umgebungsinformationen zurück
app.get('/api/config', (req: Request, res: Response) => {
  const backendUrl = process.env.BACKEND_URL || `http://localhost:${PORT}`;
  res.json({
    backendUrl,
    environment: process.env.NODE_ENV || 'development',
    version: process.env.APP_VERSION || '1.0.0'
  });
});

// GS1 Debug Logging Endpoint
app.post('/api/debug/gs1-log', (req: Request, res: Response) => {
  const { barcode, hexDump, parsedResult, source } = req.body;
  
  console.log('\n========================================');
  console.log('=== GS1 BARCODE DEBUG LOG ===');
  console.log('========================================');
  console.log('Timestamp:', new Date().toISOString());
  console.log('Source:', source || 'unknown');
  console.log('----------------------------------------');
  console.log('RAW BARCODE:');
  console.log(barcode);
  console.log('----------------------------------------');
  console.log('BARCODE LÄNGE:', barcode?.length);
  console.log('----------------------------------------');
  console.log('HEX DUMP (jedes Zeichen):');
  console.log(hexDump);
  console.log('----------------------------------------');
  console.log('PARSED RESULT:');
  console.log(JSON.stringify(parsedResult, null, 2));
  console.log('========================================\n');
  
  res.json({ received: true });
});

// SPA Fallback nur aktivieren, wenn Frontend-Build vorhanden ist
if (fs.existsSync(frontendBuildPath)) {
  app.get(/^(?!\/api\/|\/health$).*/, (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
  });
}

// Error Handling Middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`✅ Server läuft auf Port ${PORT}`);
  console.log(`📊 Umgebung: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
