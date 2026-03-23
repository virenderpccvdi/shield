import { Box, Stack, Avatar, Typography, Chip, LinearProgress, Tooltip, Button } from '@mui/material';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import TuneIcon from '@mui/icons-material/Tune';
import DnsIcon from '@mui/icons-material/Dns';
import { AVATAR_COLORS, FILTER_COLORS, getInitials } from '../utils/profileUtils';

export interface CompactProfileData {
  id: string;
  name?: string;
  age?: number;
  filterLevel?: string;
  dnsClientId?: string;
}

export interface CompactProfileDnsRules {
  profileId: string;
  enabledCategories?: Record<string, boolean>;
  customBlocklist?: string[];
  customAllowlist?: string[];
}

interface Props {
  profile: CompactProfileData;
  rules?: CompactProfileDnsRules;
  colorIndex: number;
  manageLabel?: string;
  onManage: () => void;
}

/**
 * Compact child-profile card showing DNS filter stats.
 * Used inside expandable customer rows on ISP and Admin app-control pages.
 */
export default function CompactProfileCard({ profile, rules, colorIndex, manageLabel = 'Manage DNS Rules', onManage }: Props) {
  const filterConf = FILTER_COLORS[profile.filterLevel ?? 'MODERATE'];
  const totalCats = Object.keys(rules?.enabledCategories ?? {}).length;
  const blockedCats = Object.values(rules?.enabledCategories ?? {}).filter(v => v === false).length;
  const customBlocked = rules?.customBlocklist?.length ?? 0;
  const customAllowed = rules?.customAllowlist?.length ?? 0;
  const color = AVATAR_COLORS[colorIndex % AVATAR_COLORS.length];

  return (
    <Box sx={{
      p: 1.5, bgcolor: '#F8FAFC', borderRadius: 2, border: '1px solid #E2E8F0',
      transition: 'all 0.2s ease',
      '&:hover': { bgcolor: '#EFF6FF', borderColor: '#BFDBFE', transform: 'translateY(-1px)' },
    }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <Avatar sx={{ width: 28, height: 28, fontSize: 11, bgcolor: color, fontWeight: 700 }}>
          {getInitials(profile.name, 'C')}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography fontWeight={700} fontSize={13} noWrap>{profile.name ?? `Profile`}</Typography>
          {profile.age && <Typography variant="caption" color="text.secondary">Age {profile.age}</Typography>}
        </Box>
        <Chip size="small" label={filterConf.label}
          sx={{ height: 20, fontSize: 10, fontWeight: 600, bgcolor: filterConf.bg, color: filterConf.text }} />
      </Stack>

      {totalCats > 0 && (
        <Box sx={{ mb: 1 }}>
          <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.25 }}>
            <Typography variant="caption" color="text.secondary">Categories blocked</Typography>
            <Typography variant="caption" fontWeight={600}>{blockedCats}/{totalCats}</Typography>
          </Stack>
          <LinearProgress variant="determinate"
            value={totalCats > 0 ? (blockedCats / totalCats) * 100 : 0}
            sx={{ height: 4, borderRadius: 2, bgcolor: '#E2E8F0', '& .MuiLinearProgress-bar': { bgcolor: '#E53935' } }} />
        </Box>
      )}

      <Stack direction="row" spacing={0.75} sx={{ mb: 1 }}>
        <Chip size="small" icon={<BlockIcon sx={{ fontSize: 11 }} />} label={`${customBlocked} blocked`}
          sx={{ height: 20, fontSize: 10, bgcolor: '#FEF2F2', color: '#B71C1C', fontWeight: 600 }} />
        <Chip size="small" icon={<CheckCircleIcon sx={{ fontSize: 11 }} />} label={`${customAllowed} allowed`}
          sx={{ height: 20, fontSize: 10, bgcolor: '#F0FDF4', color: '#15803D', fontWeight: 600 }} />
      </Stack>

      {profile.dnsClientId && (
        <Tooltip title="Copy Private DNS address">
          <Typography variant="caption" onClick={() => navigator.clipboard.writeText(profile.dnsClientId!)}
            sx={{
              fontFamily: 'monospace', fontSize: 10, color: '#1565C0', bgcolor: '#EFF6FF',
              px: 0.75, py: 0.25, borderRadius: 0.75, display: 'block', mb: 1,
              cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
            <DnsIcon sx={{ fontSize: 10, mr: 0.25 }} />{profile.dnsClientId}
          </Typography>
        </Tooltip>
      )}

      <Button fullWidth size="small" variant="outlined" startIcon={<TuneIcon sx={{ fontSize: 13 }} />}
        onClick={onManage}
        sx={{
          fontSize: 11, py: 0.5, fontWeight: 600,
          borderColor: color, color,
          '&:hover': { bgcolor: `${color}12` },
        }}>
        {manageLabel}
      </Button>
    </Box>
  );
}
