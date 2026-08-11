import {
  Box, Divider, Flex, Heading, SimpleGrid, Spinner, Stat, StatHelpText,
  StatLabel, StatNumber, Text, useColorModeValue, Select, HStack,
  Table, Thead, Tbody, Tr, Th, Td, Badge,
} from '@chakra-ui/react';
import { useEffect, useState, useMemo } from 'react';
import { useApp } from '../hailer/use-app';

const INSIGHT_TICKETS = '6a7181fc693253992c877b11';
const INSIGHT_TRIPS   = '6a718201693253992c877b29';

const currentYear = new Date().getFullYear().toString();

function fmt(val: unknown): string {
  const n = Number(val);
  if (!val || isNaN(n) || n === 0) return '—';
  return '€' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function tsToYear(val: unknown): string {
  if (!val) return 'Unknown';
  const n = Number(val);
  if (isNaN(n) || n === 0) return 'Unknown';
  const ms = n > 1e10 ? n : n * 1000;
  return new Date(ms).getFullYear().toString();
}

function parseInsight(data: { headers: string[]; rows: unknown[][] }): Record<string, unknown>[] {
  return data.rows.map(row => {
    const r: Record<string, unknown> = {};
    data.headers.forEach((h, i) => { r[h] = row[i]; });
    return r;
  });
}

interface Props { refreshKey?: number; }

export default function SupportKPI({ refreshKey = 0 }: Props) {
  const { hailer, inside, user } = useApp();
  const [ticketRows, setTicketRows] = useState<Record<string, unknown>[]>([]);
  const [tripsRows, setTripsRows]   = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading]       = useState(true);
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const cardBg      = useColorModeValue('white', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const theadBg     = useColorModeValue('gray.50', 'gray.800');
  const rowHover    = useColorModeValue('gray.50', 'gray.600');

  useEffect(() => {
    if (!inside) return;
    setLoading(true);
    Promise.all([
      hailer!.insight.data(INSIGHT_TICKETS, { update: true }),
      hailer!.insight.data(INSIGHT_TRIPS, { update: true }),
    ]).then(([tickets, trips]) => {
      setTicketRows(parseInsight(tickets));
      setTripsRows(parseInsight(trips));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [inside, refreshKey]);

  const years = useMemo(() => {
    const ys = new Set<string>();
    ticketRows.forEach(r => { const y = tsToYear(r.dateReceived); if (y !== 'Unknown') ys.add(y); });
    tripsRows.forEach(r => { const y = String(r.yearOfService || '').trim(); if (y) ys.add(y); });
    return ['All', ...Array.from(ys).sort((a, b) => b.localeCompare(a))];
  }, [ticketRows, tripsRows]);

  // Filter tickets by year
  const filteredTickets = selectedYear === 'All'
    ? ticketRows
    : ticketRows.filter(r => tsToYear(r.dateReceived) === selectedYear);

  const resolvedTickets = filteredTickets.filter(r => r.phase === 'Done');
  const openTickets     = filteredTickets.filter(r => r.phase !== 'Done');
  const billableTickets = filteredTickets.filter(r => r.billable === 'Yes');

  // Avg resolution time (days)
  const resolved = resolvedTickets.filter(r => r.dateReceived && r.ticketComplete);
  const avgResolutionDays = resolved.length > 0
    ? Math.round(resolved.reduce((s, r) => {
        const start = Number(r.dateReceived);
        const end   = Number(r.ticketComplete);
        const startMs = start > 1e10 ? start : start * 1000;
        const endMs   = end > 1e10 ? end : end * 1000;
        return s + Math.max(0, (endMs - startMs) / (1000 * 60 * 60 * 24));
      }, 0) / resolved.length)
    : 0;

  const billableRate = filteredTickets.length > 0
    ? Math.round((billableTickets.length / filteredTickets.length) * 100)
    : 0;

  // By engineer
  const byEngineer: Record<string, { open: number; resolved: number }> = {};
  filteredTickets.forEach(r => {
    const eng = String(r.assignedEngineer || 'Unassigned');
    if (!byEngineer[eng]) byEngineer[eng] = { open: 0, resolved: 0 };
    if (r.phase === 'Done') byEngineer[eng].resolved++;
    else byEngineer[eng].open++;
  });

  // Trips
  const filteredTrips = selectedYear === 'All'
    ? tripsRows
    : tripsRows.filter(r => String(r.yearOfService || '').trim() === selectedYear);
  const closedTrips   = filteredTrips.filter(r => r.phase === 'Closed ');
  const totalInvoiced = filteredTrips.reduce((s, r) => s + (Number(r.invoicedAmount) || 0), 0);
  const totalExpenses = filteredTrips.reduce((s, r) =>
    s + (Number(r.airfare) || 0) + (Number(r.hotel) || 0) + (Number(r.meals) || 0) +
    (Number(r.transportation) || 0) + (Number(r.other) || 0), 0);

  function userName(id: string): string {
    const u = user.map[id];
    return u ? `${u.firstname} ${u.lastname}` : id;
  }

  if (loading) return <Flex justify="center" align="center" h="300px"><Spinner size="xl" /></Flex>;

  return (
    <Box>
      <Flex justify="space-between" align="center" mb={4}>
        <Heading size="sm" color="blue.600" textTransform="uppercase" letterSpacing="wide">Support Tickets</Heading>
        <HStack>
          <Text fontSize="sm">Year:</Text>
          <Select maxW="160px" size="sm" value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </Select>
        </HStack>
      </Flex>

      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={6}>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor} borderTop="3px solid" borderTopColor="blue.400">
          <Stat><StatLabel>Total Tickets</StatLabel><StatNumber>{filteredTickets.length}</StatNumber><StatHelpText>{selectedYear}</StatHelpText></Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor} borderTop="3px solid" borderTopColor="green.400">
          <Stat><StatLabel>Resolved</StatLabel><StatNumber color="green.500">{resolvedTickets.length}</StatNumber><StatHelpText>{filteredTickets.length > 0 ? Math.round(resolvedTickets.length / filteredTickets.length * 100) : 0}% rate</StatHelpText></Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor} borderTop="3px solid" borderTopColor="orange.400">
          <Stat><StatLabel>Open</StatLabel><StatNumber color="orange.500">{openTickets.length}</StatNumber></Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor} borderTop="3px solid" borderTopColor="purple.400">
          <Stat><StatLabel>Avg Resolution</StatLabel><StatNumber>{avgResolutionDays} days</StatNumber><StatHelpText>From {resolved.length} resolved</StatHelpText></Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor} borderTop="3px solid" borderTopColor="teal.400">
          <Stat><StatLabel>Billable</StatLabel><StatNumber>{billableTickets.length}</StatNumber><StatHelpText>{billableRate}% of tickets</StatHelpText></Stat>
        </Box>
      </SimpleGrid>

      {/* By engineer */}
      {Object.keys(byEngineer).length > 0 && (
        <Box border="1px" borderColor={borderColor} borderRadius="md" overflow="hidden" mb={6}>
          <Box bg={theadBg} px={4} py={2}><Text fontWeight="semibold" fontSize="sm">By Engineer</Text></Box>
          <Table variant="simple" size="sm">
            <Thead bg={theadBg}><Tr><Th>Engineer</Th><Th isNumeric>Open</Th><Th isNumeric>Resolved</Th><Th isNumeric>Total</Th></Tr></Thead>
            <Tbody>
              {Object.entries(byEngineer).map(([eng, counts]) => (
                <Tr key={eng} _hover={{ bg: rowHover }}>
                  <Td fontWeight="medium">{eng === 'Unassigned' ? eng : userName(eng)}</Td>
                  <Td isNumeric color="orange.500">{counts.open}</Td>
                  <Td isNumeric color="green.500">{counts.resolved}</Td>
                  <Td isNumeric fontWeight="bold">{counts.open + counts.resolved}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      )}

      <Divider mb={6} />

      {/* TRIPS */}
      <Heading size="sm" mb={4} color="purple.600" textTransform="uppercase" letterSpacing="wide">TRIPS / IHS</Heading>
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor} borderTop="3px solid" borderTopColor="purple.400">
          <Stat><StatLabel>Total Trips</StatLabel><StatNumber>{filteredTrips.length}</StatNumber><StatHelpText>{closedTrips.length} completed</StatHelpText></Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor} borderTop="3px solid" borderTopColor="green.400">
          <Stat><StatLabel>Invoiced</StatLabel><StatNumber fontSize="lg">{fmt(totalInvoiced)}</StatNumber></Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor} borderTop="3px solid" borderTopColor="red.400">
          <Stat><StatLabel>Expenses</StatLabel><StatNumber fontSize="lg" color="red.500">{fmt(totalExpenses)}</StatNumber></Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor} borderTop="3px solid" borderTopColor={totalInvoiced - totalExpenses >= 0 ? 'green.400' : 'red.400'}>
          <Stat><StatLabel>Net</StatLabel><StatNumber fontSize="lg" color={totalInvoiced - totalExpenses >= 0 ? 'green.500' : 'red.500'}>{fmt(totalInvoiced - totalExpenses)}</StatNumber></Stat>
        </Box>
      </SimpleGrid>
    </Box>
  );
}
