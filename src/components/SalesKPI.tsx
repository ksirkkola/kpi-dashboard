import {
  Box, Divider, Flex, Heading, SimpleGrid, Spinner, Stat, StatHelpText,
  StatLabel, StatNumber, Text, useColorModeValue, Select, HStack,
} from '@chakra-ui/react';
import { useEffect, useState, useMemo } from 'react';
import { useApp } from '../hailer/use-app';

const INSIGHT_OPP   = '6a7181f7a8140c7b12b1d8cb';
const INSIGHT_CONFERENCE_LEADS = '6a7181f9ada150db8ae39c18';
const INSIGHT_ALL_LEADS = '6aaba34dd3474f21aed65993';
const INSIGHT_YEARLY_GOALS_REVENUE = '6aaba1c4aa19ba695eecb8e6';

const currentYear = new Date().getFullYear().toString();

// Yearly Goals insight returns one column pair per year (target2026/actual2026, ...) —
// pick the pair matching the real current year.
const YEAR_FIELD_MAP: Record<string, { target: string; actual: string }> = {
  '2026': { target: 'target2026', actual: 'actual2026' },
  '2027': { target: 'target2027', actual: 'actual2027' },
  '2028': { target: 'target2028', actual: 'actual2028' },
  '2029': { target: 'target2029', actual: 'actual2029' },
  '2030': { target: 'target2030', actual: 'actual2030' },
};

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

interface AllLeadRow {
  id: string; phase: string;
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
  const [conferenceLeadRows, setConferenceLeadRows] = useState<LeadRow[]>([]);
  const [allLeadRows, setAllLeadRows] = useState<AllLeadRow[]>([]);
  const [yearlyGoalsRows, setYearlyGoalsRows] = useState<Record<string, unknown>[]>([]);
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
      hailer!.insight.data(INSIGHT_CONFERENCE_LEADS, { update: true }),
      hailer!.insight.data(INSIGHT_ALL_LEADS, { update: true }),
      hailer!.insight.data(INSIGHT_YEARLY_GOALS_REVENUE, { update: true }),
    ]).then(([opp, conferenceLeads, allLeads, yearlyGoals]) => {
      setOppRows(parseInsight(opp) as unknown as OppRow[]);
      setConferenceLeadRows(parseInsight(conferenceLeads) as unknown as LeadRow[]);
      setAllLeadRows(parseInsight(allLeads) as unknown as AllLeadRow[]);
      setYearlyGoalsRows(parseInsight(yearlyGoals));
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

  // All Leads (every lead regardless of source channel — the general Leads workflow)
  const totalAllLeads     = allLeadRows.length;
  const allNewLeads       = allLeadRows.filter(r => r.phase === 'New').length;
  const allContacted      = allLeadRows.filter(r => r.phase === 'Contacted').length;
  const allQualified      = allLeadRows.filter(r => r.phase === 'Qualified').length;
  const allConverted      = allLeadRows.filter(r => r.phase === 'Converted').length;
  const allDisqualified   = allLeadRows.filter(r => r.phase === 'Disqualified').length;
  const allConversionRate = totalAllLeads > 0 ? Math.round((allConverted / totalAllLeads) * 100) : 0;

  // Conference Leads — a specific channel, not the full lead funnel (see "All Leads" above)
  const totalConfLeads   = conferenceLeadRows.length;
  const confNewLeads     = conferenceLeadRows.filter(r => r.phase === 'New Lead').length;
  const confContacted    = conferenceLeadRows.filter(r => r.phase === 'Contacted').length;
  const confQualified    = conferenceLeadRows.filter(r => r.phase === 'Qualified').length;
  const confDisqualified = conferenceLeadRows.filter(r => r.phase === 'Disqualified').length;
  const confConversionRate = totalConfLeads > 0 ? Math.round((confQualified / totalConfLeads) * 100) : 0;

  // Annual Revenue goal (from 5-Year Marketing Goals) — this is where Revenue Actual vs
  // Target belongs; it's a company revenue KPI, not a marketing-activity metric.
  const revenueYearFields = YEAR_FIELD_MAP[currentYear] ?? YEAR_FIELD_MAP['2026'];
  const revenueRow    = yearlyGoalsRows[0];
  const revenueActual = revenueRow ? Number(revenueRow[revenueYearFields.actual]) || 0 : 0;
  const revenueTarget = revenueRow ? Number(revenueRow[revenueYearFields.target]) || 0 : 0;

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

      {/* Annual revenue goal */}
      <Heading size="sm" mb={3} color="green.600" textTransform="uppercase" letterSpacing="wide">{currentYear} Revenue Goal</Heading>
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} mb={6}>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor} borderTop="3px solid" borderTopColor="green.400">
          <Stat><StatLabel>Revenue Actual</StatLabel><StatNumber fontSize="lg" color="green.500">{fmt(revenueActual)}</StatNumber></Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor} borderTop="3px solid" borderTopColor="gray.400">
          <Stat><StatLabel>Revenue Target</StatLabel><StatNumber fontSize="lg">{fmt(revenueTarget)}</StatNumber></Stat>
        </Box>
      </SimpleGrid>

      <Divider mb={6} />

      {/* All leads — every lead regardless of source channel */}
      <Heading size="sm" mb={3} color="teal.600" textTransform="uppercase" letterSpacing="wide">All Leads</Heading>
      <SimpleGrid columns={{ base: 2, md: 4, lg: 6 }} spacing={4} mb={6}>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor} borderTop="3px solid" borderTopColor="teal.400">
          <Stat><StatLabel>Total Leads</StatLabel><StatNumber>{totalAllLeads}</StatNumber></Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor} borderTop="3px solid" borderTopColor="blue.400">
          <Stat><StatLabel>New</StatLabel><StatNumber>{allNewLeads}</StatNumber></Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor} borderTop="3px solid" borderTopColor="purple.400">
          <Stat><StatLabel>Contacted</StatLabel><StatNumber>{allContacted}</StatNumber></Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor} borderTop="3px solid" borderTopColor="orange.400">
          <Stat><StatLabel>Qualified</StatLabel><StatNumber>{allQualified}</StatNumber></Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor} borderTop="3px solid" borderTopColor="green.400">
          <Stat><StatLabel>Converted</StatLabel><StatNumber>{allConverted}</StatNumber></Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor} borderTop="3px solid" borderTopColor="gray.400">
          <Stat><StatLabel>Disqualified</StatLabel><StatNumber>{allDisqualified}</StatNumber></Stat>
        </Box>
      </SimpleGrid>
      <Text fontSize="xs" color={mutedText} mb={6}>Conversion rate: {allConversionRate}% (Converted / Total)</Text>

      {/* Conference leads — a specific channel within All Leads above, not the full funnel */}
      <Heading size="sm" mb={3} color="cyan.600" textTransform="uppercase" letterSpacing="wide">Conference Leads (Channel)</Heading>
      <SimpleGrid columns={{ base: 2, md: 4, lg: 6 }} spacing={4}>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor} borderTop="3px solid" borderTopColor="cyan.400">
          <Stat><StatLabel>Total Leads</StatLabel><StatNumber>{totalConfLeads}</StatNumber></Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor} borderTop="3px solid" borderTopColor="blue.400">
          <Stat><StatLabel>New</StatLabel><StatNumber>{confNewLeads}</StatNumber></Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor} borderTop="3px solid" borderTopColor="purple.400">
          <Stat><StatLabel>Contacted</StatLabel><StatNumber>{confContacted}</StatNumber></Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor} borderTop="3px solid" borderTopColor="green.400">
          <Stat><StatLabel>Qualified</StatLabel><StatNumber>{confQualified}</StatNumber></Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor} borderTop="3px solid" borderTopColor="gray.400">
          <Stat><StatLabel>Disqualified</StatLabel><StatNumber>{confDisqualified}</StatNumber></Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor} borderTop="3px solid" borderTopColor="orange.400">
          <Stat><StatLabel>Conversion</StatLabel><StatNumber>{confConversionRate}%</StatNumber><StatHelpText>Lead → Qualified</StatHelpText></Stat>
        </Box>
      </SimpleGrid>
    </Box>
  );
}
