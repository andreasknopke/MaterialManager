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
  productUrl?: string;
  properties: {
    deviceLength?: string;
    shaftLength?: string;
    frenchSize?: string;
    diameter?: string;
    shapeName?: string;
  };
  matchScore: number;
  additionalInfo?: string;
  differences?: string[];
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

  const normalizeForCompare = (value?: string) => {
    if (!value) return '';
    return value
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/fr|french|ch/g, 'f')
      .replace(/,/g, '.');
  };

  const getPropertyTextColor = (
    productValue: string | undefined,
    targetValue: string | undefined
  ) => {
    if (!productValue) return 'text.secondary';
    if (!targetValue) return 'text.primary';

    const isDifferent = normalizeForCompare(productValue) !== normalizeForCompare(targetValue);
    return isDifferent ? 'error.main' : 'success.main';
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
                <Box sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography variant="caption" color="text.secondary">
                    Legende:
                  </Typography>
                  <Chip label="Grün = Eigenschaft passt" color="success" size="small" variant="outlined" />
                  <Chip label="Rot = Eigenschaft weicht ab" color="error" size="small" variant="outlined" />
                </Box>
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
                      <TableCell>Unterschiede</TableCell>
                      <TableCell>Link</TableCell>
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
                        <TableCell>
                          <Typography
                            variant="body2"
                            color={getPropertyTextColor(product.properties.deviceLength, material.properties.deviceLength)}
                          >
                            {product.properties.deviceLength || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography
                            variant="body2"
                            color={getPropertyTextColor(product.properties.shaftLength, material.properties.shaftLength)}
                          >
                            {product.properties.shaftLength || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography
                            variant="body2"
                            color={getPropertyTextColor(product.properties.frenchSize, material.properties.frenchSize)}
                          >
                            {product.properties.frenchSize || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography
                            variant="body2"
                            color={getPropertyTextColor(product.properties.diameter, material.properties.diameter)}
                          >
                            {product.properties.diameter || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography
                            variant="body2"
                            color={getPropertyTextColor(product.properties.shapeName, material.properties.shapeName)}
                          >
                            {product.properties.shapeName || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {product.differences && product.differences.length > 0 ? (
                            <Box component="ul" sx={{ m: 0, pl: 2 }}>
                              {product.differences.map((difference, diffIndex) => (
                                <Typography key={diffIndex} component="li" variant="caption" color="text.secondary">
                                  {difference}
                                </Typography>
                              ))}
                            </Box>
                          ) : (
                            <Typography variant="caption" color="success.main">
                              Keine relevanten Unterschiede
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {product.productUrl ? (
                            <Link href={product.productUrl} target="_blank" rel="noopener">
                              Öffnen
                            </Link>
                          ) : (
                            '-'
                          )}
                        </TableCell>
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
