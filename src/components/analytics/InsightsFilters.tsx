
import * as React from 'react';
import {
  Filter,
  X,
  ChevronDown,
  Calendar as CalendarIcon,
  Smile,
  Frown,
  Meh,
} from 'lucide-react';
import { format } from 'date-fns';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { DateRange } from 'react-day-picker';

const SENTIMENTS = [
  { value: 'positive', label: 'Positive', icon: Smile, className: 'text-green-600' },
  { value: 'neutral', label: 'Neutral', icon: Meh, className: 'text-gray-600' },
  { value: 'negative', label: 'Negative', icon: Frown, className: 'text-red-600' },
];
const CHANNELS = [
  { value: 'all', label: 'All channels' },
  { value: 'webchat', label: 'Web Chat' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'messenger', label: 'Messenger' },
];

export interface FiltersState {
  topics: string[];
  sentiments: string[];
  channel: string;
  dateRange: DateRange | undefined;
}

interface InsightsFiltersProps {
  filters: FiltersState;
  onFiltersChange: (filters: FiltersState) => void;
  topicOptions: string[];
  activeFilterCount: number;
}

const FilterSection: React.FC<{ title: string; children: React.ReactNode, className?: string }> = ({ title, children, className }) => (
  <div className={cn("py-4 border-b border-border last:border-b-0", className)}>
    <h3 className="text-sm font-semibold mb-3 px-4 md:px-0">{title}</h3>
    <div className="px-4 md:px-0">{children}</div>
  </div>
);

export function InsightsFilters({ filters, onFiltersChange, topicOptions, activeFilterCount }: InsightsFiltersProps) {
  const isMobile = useIsMobile();

  const handleTopicToggle = (topic: string) => {
    const newTopics = filters.topics.includes(topic)
      ? filters.topics.filter(t => t !== topic)
      : [...filters.topics, topic];
    onFiltersChange({ ...filters, topics: newTopics });
  };
  
  const handleDateRangeChange = (dateRange: DateRange | undefined) => {
    onFiltersChange({ ...filters, dateRange });
  };

  const content = (
    <div className="md:space-y-2">
      <FilterSection title="Date Range">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'w-full justify-start text-left font-normal',
                !filters.dateRange && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {filters.dateRange?.from ? (
                filters.dateRange.to ? (
                  <>
                    {format(filters.dateRange.from, 'LLL dd, y')} -{' '}
                    {format(filters.dateRange.to, 'LLL dd, y')}
                  </>
                ) : (
                  format(filters.dateRange.from, 'LLL dd, y')
                )
              ) : (
                <span>Pick a date</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={filters.dateRange?.from}
              selected={filters.dateRange}
              onSelect={handleDateRangeChange}
              numberOfMonths={isMobile ? 1 : 2}
            />
          </PopoverContent>
        </Popover>
      </FilterSection>

      <FilterSection title="Topics">
        <div className="flex flex-wrap gap-2">
          {topicOptions.map(topic => (
            <button
              key={topic}
              onClick={() => handleTopicToggle(topic)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-full transition-colors border',
                filters.topics.includes(topic)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background hover:bg-muted border-border'
              )}
            >
              {topic}
            </button>
          ))}
        </div>
      </FilterSection>
      
      <FilterSection title="Sentiment">
        <ToggleGroup
          type="multiple"
          value={filters.sentiments}
          onValueChange={sentiments => onFiltersChange({ ...filters, sentiments })}
          className="grid grid-cols-3 gap-2"
        >
          {SENTIMENTS.map(({ value, label, icon: Icon, className }) => (
            <ToggleGroupItem key={value} value={value} className="flex flex-col h-16 gap-1 data-[state=on]:bg-muted">
              <Icon className={cn("h-5 w-5", className)} />
              <span className="text-xs">{label}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </FilterSection>

      <FilterSection title="Channel">
        <Select
          value={filters.channel}
          onValueChange={channel => onFiltersChange({ ...filters, channel })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CHANNELS.map(({ value, label }) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterSection>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" className="w-full md:hidden">
            <Filter className="mr-2 h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-2 rounded-full">{activeFilterCount}</Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent className="w-[85%]">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            {content}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div className="hidden md:flex items-center gap-2 p-4 border-b bg-card">
      {/* Date Range Filter */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="w-auto justify-start text-left font-normal">
            <CalendarIcon className="mr-2 h-4 w-4" />
            {filters.dateRange?.from ? (
              filters.dateRange.to ? (
                <>
                  {format(filters.dateRange.from, 'LLL dd')} - {format(filters.dateRange.to, 'LLL dd, y')}
                </>
              ) : (
                format(filters.dateRange.from, 'LLL dd, y')
              )
            ) : (
              <span>Date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={filters.dateRange?.from}
            selected={filters.dateRange}
            onSelect={handleDateRangeChange}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>

      {/* Topic Filter */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            Topics
            {filters.topics.length > 0 && <Badge variant="secondary" className="ml-2 rounded-full h-5 w-5 flex items-center justify-center">{filters.topics.length}</Badge>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96">
          <div className="p-4">
            <h4 className="text-sm font-medium mb-4">Filter by topic</h4>
            <div className="flex flex-wrap gap-2">
              {topicOptions.map(topic => (
                <button
                  key={topic}
                  onClick={() => handleTopicToggle(topic)}
                  className={cn(
                    'px-2.5 py-1 text-sm rounded-full transition-colors border',
                    filters.topics.includes(topic)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background hover:bg-muted border-border'
                  )}
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Sentiment Filter */}
      <ToggleGroup
        type="multiple"
        size="sm"
        value={filters.sentiments}
        onValueChange={sentiments => onFiltersChange({ ...filters, sentiments })}
        className="border rounded-md"
      >
        {SENTIMENTS.map(({ value, icon: Icon, className }) => (
          <ToggleGroupItem key={value} value={value} className="px-2.5">
            <Icon className={cn("h-4 w-4", className)} />
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      
      {/* Channel Filter */}
      <Select
        value={filters.channel}
        onValueChange={channel => onFiltersChange({ ...filters, channel })}
      >
        <SelectTrigger className="w-40 h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CHANNELS.map(({ value, label }) => (
            <SelectItem key={value} value={value}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

