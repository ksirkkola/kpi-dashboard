import {
  Box, Divider, Flex, Heading, SimpleGrid, Spinner, Stat, StatHelpText,
  StatLabel, StatNumber, Text, useColorModeValue, Select, HStack, Badge,
  Table, Thead, Tbody, Tr, Th, Td,
} from '@chakra-ui/react';
import { useEffect, useState, useMemo } from 'react';
import { useApp } from '../hailer/use-app';

const INSIGHT_TRIPS = '6a718201693253992c877b29';
const INSIGHT_INV   = '6a718204891833385a34c9ec';
const INSIGHT_LINKEDIN     = '6aaba1bb317bf2cb5b48818d';
const INSIGHT_CONFERENCES  = '6aaba1c0317bf2cb5b4881bb';

const CONFERENCE_CHECKLIST_KEYS = [
  'registration', 'boothBuildPreferences', 'manikinTransportationTo', 'manikinTransportationFrom',
  'travelBooked', 'hotelBooked', 'pamphletsOrdered', 'boothInfoReceived', 'giveawaysOrdered', 'businessCardsStocked',
];

const currentYear = new Date().getFullYear().toString();

function fmt(val: unknown): string {
  const n = Number(val);
  if (!val || isNaN(n) || n === 0) return '—';
  return '€' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function parseInsight(data: { headers: string[]; rows: unknown[][] }): Record<string, unknown>[] {
  return data.rows.map(row => {
    const r: Record<string, unknown> = {};
    data.headers.forEach((h, i) => { r[h] = row[i]; });
    return r;
  });
}

interface Props { refreshKey?: number; }

export default function AdminKPI({ refreshKey = 0 }: Props) {
  const { hailer, inside } = useApp();
  const [tripsRows, setTripsRows] = useState<Record<string, unknown>[]>([]);
  const [invRows, setInvRows]     = useState<Record<string, unknown>[]>([]);
  const [linkedInRows, setLinkedInRows] = useState<Record<string, unknown>[]>([]);
  const [conferenceRows, setConferenceRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading]     = useState(true);
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const cardBg      = useColorModeValue('white', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const theadBg     = useColorModeValue('gray.50', 'gray.800');
  const rowHover    = useColorModeValue('gray.50', 'gray.600');

  useEffect(() => {
    if (!inside) return;
    setLoading(true);
    Promise.all([
      hailer!.insight.data(INSIGHT_TRIPS, { update: true }),
      hailer!.insight.data(INSIGHT_INV, { update: true }),
      hailer!.insight.data(INSIGHT_LINKEDIN, { update: true }),
      hailer!.insight.data(INSIGHT_CONFERENCES, { update: true }),
    ]).then(([trips, inv, linkedIn, conferences]) => {
      setTripsRows(parseInsight(trips));
      setInvRows(parseInsight(inv));
      setLinkedInRows(parseInsight(linkedIn));
      setConferenceRows(parseInsight(conferences));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [inside, refreshKey]);

  const years = useMemo(() => {
    const ys = new Set<string>();
    tripsRows.forEach(r => { const y = String(r.yearOfService || '').trim(); if (y) ys.add(y); });
    return ['All', ...Array.from(ys).sort((a, b) => b.localeCompare(a))];
  }, [tripsRows]);

  const filteredTrips = selectedYear === 'All'
    ? tripsRows
    : tripsRows.filter(r => String(r.yearOfService || '').trim() === selectedYear);

  const closedTrips   = filteredTrips.filter(r => r.phase === 'Closed ');
  const openTrips     = filteredTrips.filter(r => r.phase !== 'Closed ');

  const totalInvoiced  = filteredTrips.reduce((s, r) => s + (Number(r.invoicedAmount) || 0), 0);
  const totalPO        = filteredTrips.reduce((s, r) => s + (Number(r.poAmount) || 0), 0);
  const totalExpenses  = filteredTrips.reduce((s, r) =>
    s + (Number(r.airfare) || 0) + (Number(r.hotel) || 0) + (Number(r.meals) || 0) +
    (Number(r.transportation) || 0) + (Number(r.other) || 0), 0);
  const netMargin = totalInvoiced - totalExpenses;

  // Service type breakdown
  const serviceTypes: Record<string, number> = {};
  filteredTrips.forEach(r => {
    const t = String(r.serviceType || 'Unknown');
    serviceTypes[t] = (serviceTypes[t] || 0) + 1;
  });

  // Inventory stats
  const totalItems   = invRows.length;
  const outOfStock   = invRows.filter(r => (Number(r.quantityOnHand) || 0) === 0).length;
  const lowStock     = invRows.filter(r => {
    const qty = Number(r.quantityOnHand) || 0;
    const min = Number(r.minimumStock) || 0;
    return min > 0 && qty <= min && qty > 0;
  }).length;
  const criticalItems = invRows
    .filter(r => (Number(r.quantityOnHand) || 0) === 0 || ((Number(r.minimumStock) || 0) > 0 && (Number(r.quantityOnHand) || 0) <= (Number(r.minimumStock) || 0)))
    .sort((a, b) => (Number(a.quantityOnHand) || 0) - (Number(b.quantityOnHand) || 0))
    .slice(0, 5);

  // Marketing — LinkedIn Content Calendar
  const totalPosts     = linkedInRows.length;
  const scheduledPosts = linkedInRows.filter(r => r.phase === 'Scheduled').length;
  const postedPosts    = linkedInRows.filter(r => r.phase === 'Posted').length;
  const boostedPosts   = linkedInRows.filter(r => r.boosted === 'Yes').length;

  // Marketing — Conference Tracking
  const DONE_OR_CANCELLED = new Set(['Done', 'Cancelled']);
  const totalConferences    = conferenceRows.length;
  const upcomingConferences = conferenceRows.filter(r => !DONE_OR_CANCELLED.has(String(r.phase))).length;
  const prepIncompleteConferences = conferenceRows.filter(r =>
    !DONE_OR_CANCELLED.has(String(r.phase)) && CONFERENCE_CHECKLIST_KEYS.some(key => r[key] !== 'Yes'),
  ).length;

  if (loading) return <Flex justify="center" align="center" h="300px"><Spinner size="xl" /></Flex>;

  return (
    <Box>
      {/* TRIPS/IHS */}
      <Flex justify="space-between" align="center" mb={4}>
        <Heading size="sm" color="purple.600" textTransform="uppercase" letterSpacing="wide">TRIPS / IHS</Heading>
        <HStack>
          <Text fontSize="sm">Year:</Text>
          <Select maxW="160px" size="sm" value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </Select>
        </HStack>
      </Flex>

      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={6}>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor} borderTop="3px solid" borderTopColor="purple.400">
          <Stat><StatLabel>Total Trips</StatLabel><StatNumber>{filteredTrips.length}</StatNumber><StatHelpText>{closedTrips.length} closed</StatHelpText></Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor} borderTop="3px solid" borderTopColor="green.400">
          <Stat><StatLabel>Invoiced</StatLabel><StatNumber fontSize="lg">{fmt(totalInvoiced)}</StatNumber></Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor} borderTop="3px solid" borderTopColor="red.400">
          <Stat><StatLabel>Travel Expenses</StatLabel><StatNumber fontSize="lg" color="red.500">{fmt(totalExpenses)}</StatNumber></Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor} borderTop="3px solid" borderTopColor={netMargin >= 0 ? 'green.400' : 'red.400'}>
          <Stat><StatLabel>Net Margin</StatLabel><StatNumber fontSize="lg" color={netMargin >= 0 ? 'green.500' : 'red.500'}>{fmt(netMargin)}</StatNumber></Stat>
        </Box>
      </SimpleGrid>

      {/* Service type breakdown */}
      {Object.keys(serviceTypes).length > 0 && (
        <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3} mb={6}>
          {Object.entries(serviceTypes).map(([type, count]) => (
            <Box key={type} p={3} bg={cardBg} borderRadius="md" border="1px" borderColor={borderColor}>
              <Text fontSize="xs" color="gray.500">{type}</Text>
              <Text fontWeight="bold" fontSize="lg">{count}</Text>
            </Box>
          ))}
        </SimpleGrid>
      )}

      <Divider mb={6} />

      {/* Inventory */}
      <Heading size="sm" mb={4} color="orange.600" textTransform="uppercase" letterSpacing="wide">Inventory Health</Heading>
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={6}>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor} borderTop="3px solid" borderTopColor="blue.400">
          <Stat><StatLabel>Total Items</StatLabel><StatNumber>{totalItems}</StatNumber></Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor} borderTop="3px solid" borderTopColor="green.400">
          <Stat><StatLabel>Well Stocked</StatLabel><StatNumber color="green.500">{totalItems - outOfStock - lowStock}</StatNumber></Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor} borderTop="3px solid" borderTopColor="orange.400">
          <Stat><StatLabel>Low Stock</StatLabel><StatNumber color="orange.500">{lowStock}</StatNumber></Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor} borderTop="3px solid" borderTopColor="red.400">
          <Stat><StatLabel>Out of Stock</StatLabel><StatNumber color="red.500">{outOfStock}</StatNumber></Stat>
        </Box>
      </SimpleGrid>

      {criticalItems.length > 0 && (
        <Box border="1px" borderColor={borderColor} borderRadius="md" overflow="hidden">
          <Box bg={theadBg} px={4} py={2}>
            <Text fontWeight="semibold" fontSize="sm">Critical Stock Items</Text>
          </Box>
          <Table variant="simple" size="sm">
            <Thead bg={theadBg}>
              <Tr><Th>SKU</Th><Th>Item</Th><Th isNumeric>On Hand</Th><Th isNumeric>Min</Th><Th>Status</Th></Tr>
            </Thead>
            <Tbody>
              {criticalItems.map((r, i) => {
                const qty = Number(r.quantityOnHand) || 0;
                const min = Number(r.minimumStock) || 0;
                const isOut = qty === 0;
                return (
                  <Tr key={i} _hover={{ bg: rowHover }} cursor="pointer"
                    onClick={() => hailer!.ui.activity.open(r.id as string)}>
                    <Td fontWeight="medium">{String(r.sku || '—')}</Td>
                    <Td maxW="200px" isTruncated>{String(r.name)}</Td>
                    <Td isNumeric fontWeight="bold" color={isOut ? 'red.500' : 'orange.500'}>{qty}</Td>
                    <Td isNumeric>{min || '—'}</Td>
                    <Td><Badge colorScheme={isOut ? 'red' : 'orange'}>{isOut ? 'Out of Stock' : 'Low'}</Badge></Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        </Box>
      )}

      <Divider my={6} />

      {/* Marketing */}
      <Heading size="sm" mb={4} color="pink.600" textTransform="uppercase" letterSpacing="wide">Marketing</Heading>
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={4}>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor} borderTop="3px solid" borderTopColor="pink.400">
          <Stat><StatLabel>LinkedIn Posts</StatLabel><StatNumber>{totalPosts}</StatNumber><StatHelpText>{postedPosts} posted</StatHelpText></Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor} borderTop="3px solid" borderTopColor="orange.400">
          <Stat><StatLabel>Scheduled</StatLabel><StatNumber color="orange.500">{scheduledPosts}</StatNumber><StatHelpText>{boostedPosts} boosted</StatHelpText></Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor} borderTop="3px solid" borderTopColor="blue.400">
          <Stat><StatLabel>Conferences</StatLabel><StatNumber>{totalConferences}</StatNumber><StatHelpText>{upcomingConferences} upcoming</StatHelpText></Stat>
        </Box>
        <Box p={4} bg={cardBg} borderRadius="md" shadow="sm" border="1px" borderColor={borderColor} borderTop="3px solid" borderTopColor={prepIncompleteConferences > 0 ? 'red.400' : 'green.400'}>
          <Stat><StatLabel>Prep Incomplete</StatLabel><StatNumber color={prepIncompleteConferences > 0 ? 'red.500' : 'green.500'}>{prepIncompleteConferences}</StatNumber><StatHelpText>of {upcomingConferences} upcoming</StatHelpText></Stat>
        </Box>
      </SimpleGrid>
    </Box>
  );
}
