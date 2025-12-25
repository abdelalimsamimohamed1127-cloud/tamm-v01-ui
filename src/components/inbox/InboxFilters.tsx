
import * as React from 'react';
import {
  Filter,
  Calendar as CalendarIcon,
  ChevronDown,
  Globe,
  MessageCircle,
  Facebook,
  Smile,
  Frown,
  Meh,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { DateRange } from 'react-day-picker';
import { addDays, format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

const CHANNELS = [
  { value: 'webchat', label: 'Webchat', icon: Globe },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { value: 'messenger', label: 'Messenger', icon: Facebook },
];

const SENTIMENTS = [
  { value: 'positive', label: 'Positive', icon: Smile },
  { value: 'negative', label: 'Negative', icon: Frown },
  { value: 'neutral', label: 'Neutral', icon: Meh },
];

const TOPICS = ['Inquiry', 'Shipping', 'Returns', 'Pricing', 'Technical support'];

export interface InboxFiltersState {
  dateRange?: DateRange;
  channels: string[];
  topics: string[];
  sentiment: string; // single select, 'any' for no filter
}

interface InboxFiltersProps {
  filters: InboxFiltersState;
  onFiltersChange: (filters: InboxFiltersState) => void;
}

const FilterSection: React.FC<{ title: string; children: React.ReactNode, className?: string }> = ({ title, children, className }) => (
    <div className={cn("py-3", className)}>
      <h4 className="font-semibold mb-2 text-sm">{title}</h4>
      <div>{children}</div>
    </div>
  );

export function InboxFilters({ filters, onFiltersChange }: InboxFiltersProps) {
  const isMobile = useIsMobile();

  const handleChannelToggle = (channel: string) => {
    const newChannels = filters.channels.includes(channel)
      ? filters.channels.filter(c => c !== channel)
      : [...filters.channels, channel];
    onFiltersChange({ ...filters, channels: newChannels });
  };
  
  const handleTopicToggle = (topic: string) => {
    const newTopics = filters.topics.includes(topic)
      ? filters.topics.filter(t => t !== topic)
      : [...filters.topics, topic];
    onFiltersChange({ ...filters, topics: newTopics });
  };

  const activeFilterCount =
    (filters.dateRange ? 1 : 0) +
    filters.channels.length +
    filters.topics.length +
    (filters.sentiment !== 'any' ? 1 : 0);

  const filterContent = (
    <div className="p-4 space-y-2">
        <FilterSection title="Date">
            <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal h-9">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.dateRange?.from ? format(filters.dateRange.from, 'LLL dd, y') : 'Select date range'}
                    {filters.dateRange?.to ? ` - ${format(filters.dateRange.to, 'LLL dd, y')}`: ''}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    selected={filters.dateRange}
                    onSelect={(range) => onFiltersChange({ ...filters, dateRange: range })}
                    numberOfMonths={1}
                  />
                </PopoverContent>
            </Popover>
        </FilterSection>
        <FilterSection title="Channel">
              <div className="flex flex-wrap gap-2">
                {CHANNELS.map(channel => (
                  <Button size="sm" key={channel.value} variant={filters.channels.includes(channel.value) ? 'default' : 'outline'} onClick={() => handleChannelToggle(channel.value)}>{channel.label}</Button>
                ))}
              </div>
        </FilterSection>
        <FilterSection title="Topic">
            <div className="flex flex-wrap gap-2">
            {TOPICS.map(topic => (
                <Button size="sm" key={topic} variant={filters.topics.includes(topic) ? 'default' : 'outline'} onClick={() => handleTopicToggle(topic)}>{topic}</Button>
            ))}
            </div>
        </FilterSection>
        <FilterSection title="Sentiment">
            <div className="flex flex-wrap gap-2">
                <Button size="sm" variant={filters.sentiment === 'any' ? 'default' : 'outline'} onClick={() => onFiltersChange({...filters, sentiment: 'any'})}>Any</Button>
            {SENTIMENTS.map(sentiment => (
                <Button size="sm" key={sentiment.value} variant={filters.sentiment === sentiment.value ? 'default' : 'outline'} onClick={() => onFiltersChange({...filters, sentiment: sentiment.value})}>{sentiment.label}</Button>
            ))}
            </div>
        </FilterSection>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="h-9 w-9 shrink-0">
            <Filter className="h-4 w-4" />
            {activeFilterCount > 0 && <Badge variant="secondary" className="absolute -top-1 -right-1 h-4 w-4 p-0 justify-center text-xs rounded-full">{activeFilterCount}</Badge>}
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="rounded-t-lg">
          <SheetHeader className="text-left">
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          {filterContent}
        </SheetContent>
      </Sheet>
    );
  }

  return (
      <Popover>
        <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9">
                <Filter className="h-4 w-4 mr-2" />
                Filters
                {activeFilterCount > 0 && <Badge variant="secondary" className="ml-2 rounded-full">{activeFilterCount}</Badge>}
            </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96 p-0" align="end">
            {filterContent}
        </PopoverContent>
      </Popover>
  );
}
