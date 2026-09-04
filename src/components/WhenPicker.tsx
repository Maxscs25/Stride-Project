import { useState } from 'react';
import { View } from 'react-native';

import { DatePicker } from './DatePicker';
import { Chip } from './ui';
import { addDays, fmtLongDate, todayKey } from '@/lib/format';

/**
 * The Today / Yesterday / pick-a-date row used by every logging screen.
 *
 * Extracted once it was needed in a fourth place — keeping copies in sync by
 * hand is how one screen quietly ends up unable to back-date. Calendar
 * open/closed state lives here since no caller needs it.
 */
export function WhenPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (dateKey: string) => void;
}) {
  const [showCal, setShowCal] = useState(false);
  const today = todayKey();
  const yesterday = addDays(today, -1);
  const custom = value !== today && value !== yesterday;

  const pick = (k: string) => {
    onChange(k);
    setShowCal(false);
  };

  return (
    <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
        <Chip
          label="Today"
          selected={value === today && !showCal}
          onPress={() => pick(today)}
        />
        <Chip
          label="Yesterday"
          selected={value === yesterday && !showCal}
          onPress={() => pick(yesterday)}
        />
        <Chip
          // Show the chosen date once it's neither today nor yesterday, so the
          // selection stays visible after the calendar closes.
          label={custom ? fmtLongDate(value).replace(/^\w+, /, '') : 'Pick a date'}
          selected={showCal || custom}
          onPress={() => setShowCal((v) => !v)}
        />
      </View>
      {showCal ? <DatePicker value={value} onChange={pick} /> : null}
    </>
  );
}
