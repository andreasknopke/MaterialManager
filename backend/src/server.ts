import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cabinetRoutes from './routes/cabinet.routes';
import materialRoutes from './routes/material.routes';
import categoryRoutes from './routes/category.routes';
import companyRoutes from './routes/company.routes';
import barcodeRoutes from './routes/barcode.routes';
import fieldConfigRoutes from './routes/fieldConfig.routes';
import adminRoutes from './routes/admin.routes';
import unitRoutes from './routes/unit.routes';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import statisticsRoutes from './routes/statistics.routes';

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3001;

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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
app.use('/api/categories', categoryRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/barcodes', barcodeRoutes);
app.use('/api/field-configs', fieldConfigRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/units', unitRoutes);
app.use('/api/statistics', statisticsRoutes);

// Health Check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
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
