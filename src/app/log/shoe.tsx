import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ModalShell, finishLogging } from '@/components/ModalShell';
import { Chip, Field } from '@/components/ui';
import { addShoe } from '@/lib/sync';
import { useApp } from '@/store';
import { radius, useTheme } from '@/theme';

const SHOE_COLORS = ['#60A5FA', '#F87171', '#34D399', '#C084FC', '#FBBF24', '#2DD4BF'];

export default function AddShoe() {
  const { colors } = useTheme();
  const shoes = useApp((s) => s.shoes);

  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [lifespan, setLifespan] = useState(400);
  const [currentMiles, setCurrentMiles] = useState('');

  const valid = brand.trim().length > 0 && model.trim().length > 0;

  const save = () => {
    if (!valid) return;
    addShoe({
      brand: brand.trim(),
      model: model.trim(),
      lifespanMiles: lifespan,
      startingMiles: parseFloat(currentMiles) || 0,
      color: SHOE_COLORS[shoes.length % SHOE_COLORS.length],
      isDefault: shoes.filter((s) => !s.retiredAt).length === 0,
    });
    finishLogging();
  };

  return (
    <ModalShell title="Add a Shoe">
      <Field label="Brand" value={brand} onChangeText={setBrand} placeholder="Nike" />
      <Field label="Model" value={model} onChangeText={setModel} placeholder="Pegasus 41" />

      <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '700', marginBottom: 8 }}>
        Expected lifespan
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 }}>
        {[
          { mi: 250, label: '250 mi · racing' },
          { mi: 400, label: '400 mi · daily trainer' },
          { mi: 500, label: '500 mi · max cushion' },
        ].map((o) => (
          <Chip
            key={o.mi}
            label={o.label}
            selected={lifespan === o.mi}
            onPress={() => setLifespan(o.mi)}
          />
        ))}
      </View>

      <Field
        label="Miles already on them (optional)"
        value={currentMiles}
        onChangeText={setCurrentMiles}
        keyboardType="decimal-pad"
        placeholder="0"
      />

      <Pressable
        onPress={save}
        disabled={!valid}
        style={{
          backgroundColor: valid ? colors.accent : colors.surfaceAlt,
          borderRadius: radius.md,
          paddingVertical: 16,
          alignItems: 'center',
          marginTop: 8,
        }}>
        <Text
          style={{
            color: valid ? colors.onAccent : colors.textMuted,
            fontSize: 16,
            fontWeight: '800',
          }}>
          Add Shoe
        </Text>
      </Pressable>
    </ModalShell>
  );
}
