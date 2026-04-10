import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Chip, Stack, Avatar,
  Table, TableHead, TableRow, TableCell, TableBody, Paper, Tooltip,
  Button, Snackbar, Alert,
} from '@mui/material';
import SecurityIcon from '@mui/icons-material/Security';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import BusinessIcon from '@mui/icons-material/Business';
import FamilyRestroomIcon from '@mui/icons-material/FamilyRestroom';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CloseIcon from '@mui/icons-material/Close';
import AnimatedPage from '../../components/AnimatedPage';
import PageHeader from '../../components/PageHeader';

type Access = 'full' | 'limited' | 'none';

interface Permission {
  category: string;
  action: string;
  description: string;
  globalAdmin: Access;
  ispAdmin: Access;
  customer: Access;
  limitNote?: string;
}

const INITIAL_PERMISSIONS: Permission[] = [
  // Platform Management
  { category: 'Platform', action: 'Manage ISP Tenants', description: 'Create, edit, suspend, delete ISP tenants', globalAdmin: 'full', ispAdmin: 'none', customer: 'none' },
  { category: 'Platform', action: 'Manage Subscription Plans', description: 'Create and edit plan tiers and pricing', globalAdmin: 'full', ispAdmin: 'none', customer: 'none' },
  { category: 'Platform', action: 'View All Invoices', description: 'Access billing history across all accounts', globalAdmin: 'full', ispAdmin: 'limited', customer: 'limited', limitNote: 'ISP: own only · Customer: own only' },
  { category: 'Platform', action: 'System Health & Logs', description: 'View microservice health, audit logs', globalAdmin: 'full', ispAdmin: 'none', customer: 'none' },
  { category: 'Platform', action: 'Feature Flag Management', description: 'Enable/disable features per tenant', globalAdmin: 'full', ispAdmin: 'none', customer: 'none' },
  { category: 'Platform', action: 'Global DNS Blocklist', description: 'Manage platform-wide blocked domains', globalAdmin: 'full', ispAdmin: 'none', customer: 'none' },
  { category: 'Platform', action: 'AI Model Configuration', description: 'Configure AI/ML models and thresholds', globalAdmin: 'full', ispAdmin: 'none', customer: 'none' },
  { category: 'Platform', action: 'Notification Channels', description: 'Configure SMTP, push, and webhook channels', globalAdmin: 'full', ispAdmin: 'none', customer: 'none' },
  { category: 'Platform', action: 'URL Activity (All)', description: 'View DNS activity across all tenants and profiles', globalAdmin: 'full', ispAdmin: 'limited', customer: 'limited', limitNote: 'ISP: own customers · Customer: own children' },
  // User Management
  { category: 'Users', action: 'Create GLOBAL_ADMIN Users', description: 'Register new platform admins', globalAdmin: 'full', ispAdmin: 'none', customer: 'none' },
  { category: 'Users', action: 'Create ISP_ADMIN Users', description: 'Register new ISP tenant admins', globalAdmin: 'full', ispAdmin: 'none', customer: 'none' },
  { category: 'Users', action: 'Create CUSTOMER Users', description: 'Register parent/customer accounts', globalAdmin: 'full', ispAdmin: 'full', customer: 'none' },
  { category: 'Users', action: 'Edit / Suspend Users', description: 'Modify user details and account status', globalAdmin: 'full', ispAdmin: 'limited', customer: 'none', limitNote: 'ISP: own tenant customers only' },
  { category: 'Users', action: 'Delete Users', description: 'Permanently remove user accounts', globalAdmin: 'full', ispAdmin: 'limited', customer: 'none', limitNote: 'ISP: own tenant customers only' },
  // ISP / Tenant
  { category: 'Tenant', action: 'Tenant Branding', description: 'Customize logo, colors for white-label', globalAdmin: 'full', ispAdmin: 'full', customer: 'none' },
  { category: 'Tenant', action: 'Tenant DNS Filtering', description: 'Set tenant-level content category filters', globalAdmin: 'full', ispAdmin: 'full', customer: 'none' },
  { category: 'Tenant', action: 'Tenant Blocklist / Allowlist', description: 'Add domains to tenant block/allow lists', globalAdmin: 'full', ispAdmin: 'full', customer: 'none' },
  { category: 'Tenant', action: 'View Tenant Reports', description: 'Analytics and content filtering reports', globalAdmin: 'full', ispAdmin: 'full', customer: 'none' },
  { category: 'Tenant', action: 'Manage Tenant Quotas', description: 'Set maxCustomers and maxProfiles limits', globalAdmin: 'full', ispAdmin: 'none', customer: 'none' },
  { category: 'Tenant', action: 'App & Content Control', description: 'Manage DNS filtering for all customer child profiles', globalAdmin: 'full', ispAdmin: 'full', customer: 'none' },
  // Customer / Family
  { category: 'Family', action: 'Manage Child Profiles', description: 'Create, edit, delete child profiles', globalAdmin: 'full', ispAdmin: 'limited', customer: 'full', limitNote: 'ISP: view/delete only' },
  { category: 'Family', action: 'DNS Rules per Profile', description: 'Set allowed/blocked domains per child', globalAdmin: 'full', ispAdmin: 'full', customer: 'full' },
  { category: 'Family', action: 'Content Category Filters', description: 'Block content categories (adult, gaming, etc)', globalAdmin: 'full', ispAdmin: 'full', customer: 'full' },
  { category: 'Family', action: 'Time Limits & Schedules', description: 'Set daily screen time and internet schedules', globalAdmin: 'full', ispAdmin: 'none', customer: 'full' },
  { category: 'Family', action: 'GPS & Location Tracking', description: 'Real-time and history location monitoring', globalAdmin: 'full', ispAdmin: 'none', customer: 'limited', limitNote: 'Requires GPS feature on tenant plan' },
  { category: 'Family', action: 'Geofences & Alerts', description: 'Define safe zones with breach notifications', globalAdmin: 'full', ispAdmin: 'none', customer: 'limited', limitNote: 'Requires GPS feature' },
  { category: 'Family', action: 'AI Insights', description: 'AI-powered anomaly detection and reports', globalAdmin: 'full', ispAdmin: 'limited', customer: 'limited', limitNote: 'Requires AI monitoring feature' },
  { category: 'Family', action: 'Rewards System', description: 'Gamified rewards for responsible browsing', globalAdmin: 'full', ispAdmin: 'none', customer: 'limited', limitNote: 'Requires Rewards feature on plan' },
  { category: 'Family', action: 'Device Management', description: 'Register and manage child devices', globalAdmin: 'full', ispAdmin: 'limited', customer: 'full', limitNote: 'ISP: view/remove only' },
  { category: 'Family', action: 'Social Monitoring Alerts', description: 'Late night usage, gaming spikes, new categories', globalAdmin: 'full', ispAdmin: 'full', customer: 'full' },
  // Billing
  { category: 'Billing', action: 'Subscribe to Plans', description: 'Purchase subscription via Stripe Checkout', globalAdmin: 'full', ispAdmin: 'full', customer: 'full' },
  { category: 'Billing', action: 'Cancel Subscription', description: 'Cancel active Stripe subscription', globalAdmin: 'full', ispAdmin: 'full', customer: 'full' },
  { category: 'Billing', action: 'Download Invoices (PDF)', description: 'Download own billing invoices as PDF', globalAdmin: 'full', ispAdmin: 'full', customer: 'full' },
  { category: 'Billing', action: 'Change ISP Plan (Admin)', description: 'Upgrade/downgrade ISP tenant plan directly', globalAdmin: 'full', ispAdmin: 'none', customer: 'none' },
  { category: 'Billing', action: 'Export Reports (PDF/CSV)', description: 'Export customer/child analytics as PDF or CSV', globalAdmin: 'full', ispAdmin: 'full', customer: 'limited', limitNote: 'Customer: own profiles only' },
];

const CATEGORIES = ['Platform', 'Users', 'Tenant', 'Family', 'Billing'];
const ACCESS_CYCLE: Access[] = ['full', 'limited', 'none'];

const ROLE_CONFIG = [
  { key: 'globalAdmin', label: 'GLOBAL ADMIN', color: '#E53935', bg: '#FFEBEE', icon: <AdminPanelSettingsIcon />, desc: 'Full platform control. Manages all tenants, users, plans and system configuration.' },
  { key: 'ispAdmin',    label: 'ISP ADMIN',    color: '#7C4700', bg: '#FFF8E1', icon: <BusinessIcon />,          desc: 'Manages own tenant, customers, DNS filtering and content reporting for their ISP.' },
  { key: 'customer',   label: 'CUSTOMER',     color: '#2E7D32', bg: '#E8F5E9', icon: <FamilyRestroomIcon />,    desc: "Parent/guardian managing their family's internet safety, child profiles and devices." },
];

function AccessChip({ access, note, editMode, onClick }: { access: Access; note?: string; editMode?: boolean; onClick?: () => void }) {
  const chip = access === 'full' ? (
    <Chip size="small" icon={<CheckCircleIcon sx={{ fontSize: 14 }} />} label="Full"
      sx={{ height: 22, fontSize: 11, fontWeight: 600, bgcolor: '#E8F5E9', color: '#1B5E20',
        cursor: editMode ? 'pointer' : 'default', '&:hover': editMode ? { transform: 'scale(1.05)' } : {} }} />
  ) : access === 'limited' ? (
    <Tooltip title={note ?? 'Limited access'} placement="top">
      <Chip size="small" icon={<RemoveCircleOutlineIcon sx={{ fontSize: 14 }} />} label="Limited"
        sx={{ height: 22, fontSize: 11, fontWeight: 600, bgcolor: '#FFF8E1', color: '#7C4700',
          cursor: editMode ? 'pointer' : 'help', '&:hover': editMode ? { transform: 'scale(1.05)' } : {} }} />
    </Tooltip>
  ) : (
    <Chip size="small" icon={<CancelIcon sx={{ fontSize: 14 }} />} label="No access"
      sx={{ height: 22, fontSize: 11, fontWeight: 600, bgcolor: '#FAFAFA', color: '#9E9E9E',
        cursor: editMode ? 'pointer' : 'default', '&:hover': editMode ? { transform: 'scale(1.05)' } : {} }} />
  );

  if (editMode && onClick) {
    return <Box onClick={onClick} sx={{ display: 'inline-flex' }}>{chip}</Box>;
  }
  return chip;
}

const CAT_COLORS = ['#E53935', '#1565C0', '#F57F17', '#00897B', '#7B1FA2'];

export default function RolePermissionsPage() {
  const [permissions, setPermissions] = useState<Permission[]>(INITIAL_PERMISSIONS);
  const [editMode, setEditMode] = useState(false);
  const [snack, setSnack] = useState('');
  const [savedVersion, setSavedVersion] = useState(INITIAL_PERMISSIONS);

  const cycleAccess = (permIdx: number, roleKey: keyof Permission) => {
    if (!editMode) return;
    setPermissions(prev => prev.map((p, i) => {
      if (i !== permIdx) return p;
      const curr = p[roleKey] as Access;
      const nextIdx = (ACCESS_CYCLE.indexOf(curr) + 1) % ACCESS_CYCLE.length;
      return { ...p, [roleKey]: ACCESS_CYCLE[nextIdx] };
    }));
  };

  const handleSave = () => {
    setSavedVersion(permissions);
    setEditMode(false);
    setSnack('Permission matrix saved successfully');
  };

  const handleCancel = () => {
    setPermissions(savedVersion);
    setEditMode(false);
  };

  const totalByRole = (key: keyof Permission) => ({
    full: permissions.filter(p => p[key] === 'full').length,
    limited: permissions.filter(p => p[key] === 'limited').length,
    none: permissions.filter(p => p[key] === 'none').length,
  });

  return (
    <AnimatedPage>
      <PageHeader
        icon={<SecurityIcon />}
        title="Role & Permission Matrix"
        subtitle="Access control reference for all platform roles — click cells in edit mode to cycle access levels"
        iconColor="#E53935"
        action={
          editMode ? (
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" startIcon={<CloseIcon />} onClick={handleCancel}
                sx={{ borderColor: '#9E9E9E', color: '#9E9E9E' }}>
                Cancel
              </Button>
              <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave}
                sx={{ bgcolor: '#E53935', '&:hover': { bgcolor: '#C62828' } }}>
                Save Changes
              </Button>
            </Stack>
          ) : (
            <Button variant="outlined" startIcon={<EditIcon />} onClick={() => setEditMode(true)}
              sx={{ borderColor: '#E53935', color: '#E53935', '&:hover': { bgcolor: '#FFEBEE' } }}>
              Edit Permissions
            </Button>
          )
        }
      />

      {editMode && (
        <Card sx={{ mb: 3, bgcolor: '#FFF8E1', border: '1px solid #FFE082' }}>
          <CardContent sx={{ py: 1.5 }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <EditIcon sx={{ color: '#F57F17', fontSize: 18 }} />
              <Typography variant="body2" color="#E65100">
                <strong>Edit Mode:</strong> Click any access chip to cycle: <strong>Full → Limited → No Access</strong>. Changes update the policy matrix display. Save when done.
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Role Summary Cards */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {ROLE_CONFIG.map((role, i) => {
          const counts = totalByRole(role.key as keyof Permission);
          return (
            <Grid key={role.key} size={{ xs: 12, sm: 4 }}>
              <AnimatedPage delay={0.1 + i * 0.08}>
                <Card sx={{ border: `1px solid ${role.color}30`, height: '100%' }}>
                  <Box sx={{ height: 4, bgcolor: role.color }} />
                  <CardContent>
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
                      <Avatar sx={{ bgcolor: role.bg, color: role.color, width: 40, height: 40 }}>
                        {role.icon}
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography fontWeight={700} fontSize={13}>{role.label}</Typography>
                        <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                          <Chip size="small" label={`${counts.full} full`} sx={{ height: 18, fontSize: 10, bgcolor: '#E8F5E9', color: '#1B5E20', fontWeight: 600 }} />
                          <Chip size="small" label={`${counts.limited} limited`} sx={{ height: 18, fontSize: 10, bgcolor: '#FFF8E1', color: '#7C4700', fontWeight: 600 }} />
                          <Chip size="small" label={`${counts.none} none`} sx={{ height: 18, fontSize: 10, bgcolor: '#FAFAFA', color: '#9E9E9E', fontWeight: 600 }} />
                        </Stack>
                      </Box>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">{role.desc}</Typography>
                  </CardContent>
                </Card>
              </AnimatedPage>
            </Grid>
          );
        })}
      </Grid>

      {/* Permission Matrix by Category */}
      {CATEGORIES.map((cat, ci) => {
        const rows = permissions.filter(p => p.category === cat);
        const permIndices = permissions.reduce((acc, p, idx) => {
          if (p.category === cat) acc.push(idx);
          return acc;
        }, [] as number[]);
        return (
          <AnimatedPage key={cat} delay={0.2 + ci * 0.05}>
            <Card sx={{ mb: 2.5 }}>
              <CardContent sx={{ pb: '0 !important' }}>
                <Typography fontWeight={700} fontSize={15} sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box component="span" sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: CAT_COLORS[ci], display: 'inline-block' }} />
                  {cat}
                  <Chip size="small" label={`${rows.length} permissions`} sx={{ height: 18, fontSize: 10, bgcolor: '#F1F5F9', color: '#64748B' }} />
                </Typography>
              </CardContent>
              <Paper elevation={0}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                      <TableCell sx={{ fontWeight: 600, color: '#64748B', fontSize: 12, width: '28%' }}>Permission</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: '#64748B', fontSize: 12, width: '28%' }}>Description</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: '#E53935', fontSize: 12, textAlign: 'center', width: '14%' }}>GLOBAL ADMIN</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: '#92400E', fontSize: 12, textAlign: 'center', width: '14%' }}>ISP ADMIN</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: '#2E7D32', fontSize: 12, textAlign: 'center', width: '16%' }}>CUSTOMER</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((p, ri) => {
                      const globalIdx = permIndices[ri];
                      return (
                        <TableRow key={ri} sx={{ '&:hover': { bgcolor: editMode ? '#FFFDE7' : '#F8FAFC' } }}>
                          <TableCell><Typography variant="body2" fontWeight={600} fontSize={13}>{p.action}</Typography></TableCell>
                          <TableCell><Typography variant="caption" color="text.secondary">{p.description}</Typography></TableCell>
                          <TableCell sx={{ textAlign: 'center' }}>
                            <AccessChip access={p.globalAdmin} note={p.limitNote} editMode={editMode}
                              onClick={() => cycleAccess(globalIdx, 'globalAdmin')} />
                          </TableCell>
                          <TableCell sx={{ textAlign: 'center' }}>
                            <AccessChip access={p.ispAdmin} note={p.limitNote} editMode={editMode}
                              onClick={() => cycleAccess(globalIdx, 'ispAdmin')} />
                          </TableCell>
                          <TableCell sx={{ textAlign: 'center' }}>
                            <AccessChip access={p.customer} note={p.limitNote} editMode={editMode}
                              onClick={() => cycleAccess(globalIdx, 'customer')} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Paper>
            </Card>
          </AnimatedPage>
        );
      })}

      <AnimatedPage delay={0.5}>
        <Card sx={{ bgcolor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
          <CardContent>
            <Stack direction="row" spacing={2} flexWrap="wrap" gap={1.5}>
              <Stack direction="row" spacing={0.75} alignItems="center">
                <CheckCircleIcon sx={{ color: '#2E7D32', fontSize: 16 }} />
                <Typography variant="caption" fontWeight={600}>Full — unrestricted access</Typography>
              </Stack>
              <Stack direction="row" spacing={0.75} alignItems="center">
                <RemoveCircleOutlineIcon sx={{ color: '#E65100', fontSize: 16 }} />
                <Typography variant="caption" fontWeight={600}>Limited — scoped or feature-gated (hover for details)</Typography>
              </Stack>
              <Stack direction="row" spacing={0.75} alignItems="center">
                <CancelIcon sx={{ color: '#9E9E9E', fontSize: 16 }} />
                <Typography variant="caption" fontWeight={600}>No Access — endpoint returns 403</Typography>
              </Stack>
              {editMode && (
                <Typography variant="caption" color="#F57F17" fontWeight={600}>
                  · Edit Mode: click chips to cycle access levels
                </Typography>
              )}
            </Stack>
          </CardContent>
        </Card>
      </AnimatedPage>

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" onClose={() => setSnack('')}>{snack}</Alert>
      </Snackbar>
    </AnimatedPage>
  );
}
