import { Skeleton, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';

export default function SkeletonTable({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <Table>
      <TableHead>
        <TableRow sx={{ bgcolor: '#F8FAFC' }}>
          {Array.from({ length: columns }).map((_, i) => (
            <TableCell key={i}><Skeleton variant="text" width={80 + Math.random() * 40} /></TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {Array.from({ length: rows }).map((_, r) => (
          <TableRow key={r}>
            {Array.from({ length: columns }).map((_, c) => (
              <TableCell key={c}><Skeleton variant="text" width={60 + Math.random() * 60} animation="wave" /></TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
