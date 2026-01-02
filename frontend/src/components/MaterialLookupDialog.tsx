import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Box,
  Chip,
  CircularProgress,
  Alert,
  Link,
} from '@mui/material';
import { CheckCircle as CheckCircleIcon } from '@mui/icons-material';

interface SimilarProduct {
  name: string;
  properties: {
    deviceLength?: string;
    shaftLength?: string;
    frenchSize?: string;
    diameter?: string;
    shapeName?: string;
  };
  matchScore: number;
  additionalInfo?: string;
}

interface MaterialLookupDialogProps {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  error: string | null;
  material?: {
    id: number;
    name: string;
    category: string;
    properties: {
      deviceLength?: string;
      shaftLength?: string;
      frenchSize?: string;
      diameter?: string;
      shapeName?: string;
    };
  };
  sourceUrl?: string;
  results?: SimilarProduct[];
}

const MaterialLookupDialog: React.FC<MaterialLookupDialogProps> = ({
  open,
  onClose,
  loading,
  error,
  material,
  sourceUrl,
  results,
}) => {
  const getMatchColor = (score: number) => {
    if (score >= 0.95) return 'success';
    if (score >= 0.85) return 'info';
    return 'warning';
  };

  const getMatchLabel = (score: number) => {
    if (score >= 0.95) return 'Perfekt';
    if (score >= 0.85) return 'Sehr ähnlich';
    return 'Ähnlich';
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        Material Lookup - Ähnliche Produkte
        {material && (
          <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }}>
            Suche für: {material.name} ({material.category})
          </Typography>
        )}
      </DialogTitle>
      
      <DialogContent>
        {loading && (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
            <CircularProgress />
            <Typography sx={{ ml: 2 }}>
              Analysiere Webseite und suche ähnliche Produkte...
            </Typography>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {!loading && !error && material && (
          <>
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom>
                <strong>Gesuchte Eigenschaften:</strong>
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {material.properties.deviceLength && (
                  <Chip label={`Device-Länge: ${material.properties.deviceLength}`} size="small" />
                )}
                {material.properties.shaftLength && (
                  <Chip label={`Schaftlänge: ${material.properties.shaftLength}`} size="small" />
                )}
                {material.properties.frenchSize && (
                  <Chip label={`French-Size: ${material.properties.frenchSize}`} size="small" />
                )}
                {material.properties.diameter && (
                  <Chip label={`Durchmesser: ${material.properties.diameter}`} size="small" />
                )}
                {material.properties.shapeName && (
                  <Chip label={`Shape: ${material.properties.shapeName}`} size="small" />
                )}
              </Box>
              {sourceUrl && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Quelle: <Link href={sourceUrl} target="_blank" rel="noopener">{sourceUrl}</Link>
                </Typography>
              )}
            </Box>

            {results && results.length > 0 ? (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Match</TableCell>
                      <TableCell>Produktname</TableCell>
                      <TableCell>Device-Länge</TableCell>
                      <TableCell>Schaftlänge</TableCell>
                      <TableCell>French-Size</TableCell>
                      <TableCell>Durchmesser</TableCell>
                      <TableCell>Shape</TableCell>
                      <TableCell>Zusatzinfo</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {results.map((product, index) => (
                      <TableRow key={index} hover>
                        <TableCell>
                          <Chip
                            icon={<CheckCircleIcon />}
                            label={`${(product.matchScore * 100).toFixed(0)}% - ${getMatchLabel(product.matchScore)}`}
                            color={getMatchColor(product.matchScore)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {product.name}
                          </Typography>
                        </TableCell>
                        <TableCell>{product.properties.deviceLength || '-'}</TableCell>
                        <TableCell>{product.properties.shaftLength || '-'}</TableCell>
                        <TableCell>{product.properties.frenchSize || '-'}</TableCell>
                        <TableCell>{product.properties.diameter || '-'}</TableCell>
                        <TableCell>{product.properties.shapeName || '-'}</TableCell>
                        <TableCell>
                          {product.additionalInfo && (
                            <Typography variant="caption" color="text.secondary">
                              {product.additionalInfo}
                            </Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : !loading && !error ? (
              <Alert severity="info">
                Keine ähnlichen Produkte gefunden. Das LLM konnte keine Produkte mit übereinstimmenden Eigenschaften auf der Webseite identifizieren.
              </Alert>
            ) : null}
          </>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>Schließen</Button>
      </DialogActions>
    </Dialog>
  );
};

export default MaterialLookupDialog;
