import {
  Box, Divider, Flex, Heading, SimpleGrid, Spinner, Stat, StatHelpText,
  StatLabel, StatNumber, Text, useColorModeValue, Select, HStack,
} from '@chakra-ui/react';
import { useEffect, useState, useMemo } from 'react';
import { useApp } from '../hailer/use-app';

const INSIGHT_OPP   = '6a7181f7a8140c7b12b1d8cb';
const INSIGHT_LEADS = '6a7181f9ada150db8ae39c18';

const currentYear = new Date().getFullYear().toString();

interface OppRow {
  id: string; phase: string;
  closedWonDate: number | null;
  quotedRevenue: number | null;
  tmxeRevenue: number | null;
  poAmount: number | null;
}

interface LeadRow {
  id: string; phase: string;
  followUpDate: number | null;
}

function fmt(val: unknown): string {
  const n = Number(val);
  if (!val || isNaN(n) || n === 0) return '—';
  return '€' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function getYear(val: unknown): string {
  if (!val) return 'Unknown';
  const n = Number(val);
  if (isNaN(n) || n === 0) return 'Unknown';
  return new Date(n * 1000).getFullYear().toString();
}

function parseInsight(data: { headers: string[]; rows: unknown[][] }): Record<string, unknown>[] {
  return data.rows.map(row => {
    const r: Record<string, unknown> = {};
    data.headers.forEach((h, i) => { r[h] = row[i]; });
    return r;
  });
}

interface Props { refreshKey?: number; }

export default function SalesKPI({ refreshKey = 0 }: Props) {
  const { hailer, inside } = useApp();
  const [oppRows, setOppRows]   = useState<OppRow[]>([]);
  const [leadRows, setLeadRows] = useState<LeadRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const cardBg      = useColorModeValue('white', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const mutedText   = useColorModeValue('gray.500', 'gray.400');

  useEffect(() => {
    if (!inside) return;
    setLoading(true);
    Promise.all([
      hailer!.insight.data(INSIGHT_OPP, { update: true }),
      hailer!.insight.data(INSIGHT_LEADS, { update: true }),
    ]).then(([opp, leads]) => {
      setOppRows(parseInsight(opp) as unknown as OppRow[]);
      setLeadRows(parseInsight(leads) as unknown as LeadRow[]);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [inside, refreshKey]);

  // Available years from won opportunities
  const years = useMemo(() => {
    const ys = new Set<string>();
    oppRows.forEach(r => { const y = getYear(r.closedWonDate); if (y !== 'Unknown') ys.add(y); });
    return ['All Time', ...Array.from(ys).sort((a, b) => b.localeCompare(a))];
  }, [oppRows]);

  const wonOpps   = oppRows.filter(r => r.phase === 'Closed - Won');
  const lostOpps  = oppRows.filter(r => r.phase === 'Closed - Lost');
  const openOpps  = oppRows.filter(r => !['Closed - Won', 'Closed - Lost'].includes(r.phase));

  const wonFiltered = selectedYear === 'All Time'
    ? wonOpps
    : wonOpps.filter(r => getYear(r.closedWonDate) === selectedYear);

  const totalWonRevenue  = wonFiltered.reduce((s, r) => s + (Number(r.quotedRevenue) || 0), 0);
  const totalWonTmxe     = wonFiltered.reduce((s, r) => s + (Number(r.tmxeRevenue) || 0), 0);
  const totalWonPO       = wonFiltered.reduce((s, r) => s + (Number(r.poAmount) || 0), 0);
  const avgDealSize      = wonFiltered.length > 0 ? totalWonRevenue / wonFiltered.length : 0;
  const totalDeals       = wonOpps.length + lostOpps.length;
  const winRate          = totalDeals > 0 ? Math.round((wonOpps.length / totalDeals) * 100) : 0;
  const pipelineValue    = openOpps.reduce((s, r) => s + (Number(r.quotedRevenue) || 0), 0);

  // Leads KPIs
  const totalLeads      = leadRows.length;
  const newLeads        = leadRows.filter(r => r.phase === 'New Lead').length;
  const contacted       = leadRows.filter(r => r.phase === 'Contacted').length;
  const qualified       = leadRows.filter(r => r.phase === 'Qualified').length;
  const disqualified    = leadRows.filter(r => r.phase === 'Disqualified').length;
  const conversionRate  = totalLeads > 0 ? Math.round((qualified / totalLeads) * 100) : 0;

  if (loading) return <Flex justify="center" align="center" h="300px"><Spinner size="xl" /></Flex>;

  return (
    <Box>
      {/* Year filter */}
      <HStack mb={6}>
        <Text fontWeight="semibold">Period:</Text>
        <Select maxW="180px" size="sm" value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </Select>
      </HStack>

      {/* Won deals */}
      <Heading size="sm" mb={3} color="green.600" textTransform="uppercase" letterSpacing="wide">Closed — Won</Heading>
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={6}>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor} borderTop="3px solid" borderTopColor="green.400">
          <Stat><StatLabel>Deals Won</StatLabel><StatNumber>{wonFiltered.length}</StatNumber><StatHelpText>{selectedYear}</StatHelpText></Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor} borderTop="3px solid" borderTopColor="green.400">
          <Stat><StatLabel>Won Revenue</StatLabel><StatNumber fontSize="lg">{fmt(totalWonRevenue)}</StatNumber><StatHelpText>Quoted</StatHelpText></Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor} borderTop="3px solid" borderTopColor="green.400">
          <Stat><StatLabel>TMXE Revenue</StatLabel><StatNumber fontSize="lg">{fmt(totalWonTmxe)}</StatNumber><StatHelpText>System sale</StatHelpText></Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor} borderTop="3px solid" borderTopColor="green.400">
          <Stat><StatLabel>Avg Deal Size</StatLabel><StatNumber fontSize="lg">{fmt(avgDealSize)}</StatNumber><StatHelpText>Per won deal</StatHelpText></Stat>
        </Box>
      </SimpleGrid>

      {/* Pipeline & performance */}
      <Heading size="sm" mb={3} color="blue.600" textTransform="uppercase" letterSpacing="wide">Pipeline & Performance</Heading>
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={6}>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor} borderTop="3px solid" borderTopColor="blue.400">
          <Stat><StatLabel>Open Pipeline</StatLabel><StatNumber>{openOpps.length}</StatNumber><StatHelpText>{fmt(pipelineValue)}</StatHelpText></Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor} borderTop="3px solid" borderTopColor="blue.400">
          <Stat><StatLabel>Win Rate</StatLabel><StatNumber>{winRate}%</StatNumber><StatHelpText>{wonOpps.length}W / {lostOpps.length}L all time</StatHelpText></Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor} borderTop="3px solid" borderTopColor="red.400">
          <Stat><StatLabel>Deals Lost</StatLabel><StatNumber>{lostOpps.length}</StatNumber><StatHelpText>All time</StatHelpText></Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor} borderTop="3px solid" borderTopColor="purple.400">
          <Stat><StatLabel>PO Received</StatLabel><StatNumber fontSize="lg">{fmt(totalWonPO)}</StatNumber><StatHelpText>{selectedYear}</StatHelpText></Stat>
        </Box>
      </SimpleGrid>

      <Divider mb={6} />

      {/* Conference leads */}
      <Heading size="sm" mb={3} color="teal.600" textTransform="uppercase" letterSpacing="wide">Conference Leads</Heading>
      <SimpleGrid columns={{ base: 2, md: 4, lg: 6 }} spacing={4}>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor} borderTop="3px solid" borderTopColor="teal.400">
          <Stat><StatLabel>Total Leads</StatLabel><StatNumber>{totalLeads}</StatNumber></Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor} borderTop="3px solid" borderTopColor="blue.400">
          <Stat><StatLabel>New</StatLabel><StatNumber>{newLeads}</StatNumber></Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor} borderTop="3px solid" borderTopColor="purple.400">
          <Stat><StatLabel>Contacted</StatLabel><StatNumber>{contacted}</StatNumber></Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor} borderTop="3px solid" borderTopColor="green.400">
          <Stat><StatLabel>Qualified</StatLabel><StatNumber>{qualified}</StatNumber></Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor} borderTop="3px solid" borderTopColor="gray.400">
          <Stat><StatLabel>Disqualified</StatLabel><StatNumber>{disqualified}</StatNumber></Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor} borderTop="3px solid" borderTopColor="orange.400">
          <Stat><StatLabel>Conversion</StatLabel><StatNumber>{conversionRate}%</StatNumber><StatHelpText>Lead → Qualified</StatHelpText></Stat>
        </Box>
      </SimpleGrid>
    </Box>
  );
}
