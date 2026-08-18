import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { ModalShell, finishLogging } from '@/components/ModalShell';
import { Chip, Field } from '@/components/ui';
import { shoeMiles } from '@/lib/load';
import { addShoe, deleteShoe, updateShoe } from '@/lib/sync';
import { useApp } from '@/store';
import { radius, useTheme } from '@/theme';

const SHOE_COLORS = ['#60A5FA', '#F87171', '#34D399', '#C084FC', '#FBBF24', '#2DD4BF'];
const LIFESPANS = [
  { mi: 250, label: '250 mi · racing' },
  { mi: 400, label: '400 mi · daily trainer' },
  { mi: 500, label: '500 mi · max cushion' },
];

export default function AddShoe() {
  const { colors } = useTheme();
  const shoes = useApp((s) => s.shoes);
  const runs = useApp((s) => s.runs);
  // Same form edits an existing shoe when given an `id`.
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = shoes.find((s) => s.id === id);

  const [brand, setBrand] = useState(editing?.brand ?? '');
  const [model, setModel] = useState(editing?.model ?? '');
  const [lifespan, setLifespan] = useState(editing?.lifespanMiles ?? 400);
  const [currentMiles, setCurrentMiles] = useState(
    editing ? String(editing.startingMiles) : ''
  );

  const valid = brand.trim().length > 0 && model.trim().length > 0;
  // Miles from logged runs are derived, so only the starting offset is editable.
  const loggedMiles = editing ? shoeMiles(editing, runs) - editing.startingMiles : 0;

  const save = () => {
    if (!valid) return;
    if (editing) {
      updateShoe({
        ...editing,
        brand: brand.trim(),
        model: model.trim(),
        lifespanMiles: lifespan,
        startingMiles: parseFloat(currentMiles) || 0,
      });
      router.back();
      return;
    }
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

  const toggleRetired = () => {
    if (!editing) return;
    updateShoe({
      ...editing,
      retiredAt: editing.retiredAt ? null : new Date().toISOString(),
    });
    router.back();
  };

  const confirmDelete = () => {
    if (!editing) return;
    Alert.alert(
      'Delete this shoe?',
      'Runs logged with it are kept — they just stop counting toward any shoe. Retire it instead to keep its mileage history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteShoe(editing.id);
            router.back();
          },
        },
      ]
    );
  };

  return (
    <ModalShell title={editing ? 'Edit Shoe' : 'Add a Shoe'}>
      <Field label="Brand" value={brand} onChangeText={setBrand} placeholder="Nike" />
      <Field label="Model" value={model} onChangeText={setModel} placeholder="Pegasus 41" />

      <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '700', marginBottom: 8 }}>
        Expected lifespan
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 }}>
        {LIFESPANS.map((o) => (
          <Chip
            key={o.mi}
            label={o.label}
            selected={lifespan === o.mi}
            onPress={() => setLifespan(o.mi)}
          />
        ))}
      </View>

      <Field
        label={editing ? 'Miles they had before Stride' : 'Miles already on them (optional)'}
        value={currentMiles}
        onChangeText={setCurrentMiles}
        keyboardType="decimal-pad"
        placeholder="0"
      />
      {editing ? (
        <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: -6, marginBottom: 14 }}>
          Plus {Math.round(loggedMiles)} mi from runs you've logged in Stride.
        </Text>
      ) : null}

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
          {editing ? 'Save Changes' : 'Add Shoe'}
        </Text>
      </Pressable>

      {editing ? (
        <>
          <Pressable onPress={toggleRetired} style={{ alignItems: 'center', paddingVertical: 14 }}>
            <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '700' }}>
              {editing.retiredAt ? 'Un-retire this shoe' : 'Retire this shoe'}
            </Text>
          </Pressable>
          <Pressable onPress={confirmDelete} style={{ alignItems: 'center', paddingVertical: 6 }}>
            <Text style={{ color: colors.danger, fontSize: 14, fontWeight: '700' }}>
              Delete this shoe
            </Text>
          </Pressable>
        </>
      ) : null}
    </ModalShell>
  );
}
