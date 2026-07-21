import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { ModalShell, finishLogging } from '@/components/ModalShell';
import { Chip, Field } from '@/components/ui';
import { searchFoods } from '@/lib/food';
import { todayKey } from '@/lib/format';
import { logFood } from '@/lib/sync';
import { MEAL_META, type FoodItem, type Meal } from '@/lib/types';
import { radius, useTheme } from '@/theme';

function mealForNow(): Meal {
  const h = new Date().getHours();
  if (h < 11) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 21) return 'dinner';
  return 'snack';
}

export default function LogFood() {
  const { colors } = useTheme();
  // The scanner returns a resolved item via params (JSON) when a barcode hits.
  const params = useLocalSearchParams<{ scanned?: string }>();

  const [meal, setMeal] = useState<Meal>(mealForNow());
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<FoodItem | null>(null);
  const [manual, setManual] = useState(false);
  const [servings, setServings] = useState('1');
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (params.scanned) {
      try {
        setSelected(JSON.parse(params.scanned) as FoodItem);
      } catch {}
    }
  }, [params.scanned]);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    debounce.current = setTimeout(async () => {
      const r = await searchFoods(query);
      setResults(r);
      setSearching(false);
    }, 450);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query]);

  const save = (item: FoodItem, method: 'search' | 'barcode' | 'manual') => {
    const mult = Math.max(0.25, parseFloat(servings) || 1);
    logFood({
      date: todayKey(),
      meal,
      name: item.name,
      servings: mult,
      calories: Math.round(item.calories * mult),
      proteinG: Math.round(item.proteinG * mult),
      carbsG: Math.round(item.carbsG * mult),
      fatG: Math.round(item.fatG * mult),
      entryMethod: method,
    });
    finishLogging();
  };

  // ---------- Manual entry ----------
  if (manual) {
    return <ManualEntry meal={meal} onMeal={setMeal} onCancel={() => setManual(false)} onSave={save} />;
  }

  // ---------- Confirm a selected/scanned item ----------
  if (selected) {
    const mult = Math.max(0.25, parseFloat(servings) || 1);
    return (
      <ModalShell title="Add Food">
        <MealPicker meal={meal} onChange={setMeal} />
        <View
          style={{
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.lg,
            padding: 16,
            marginBottom: 16,
          }}>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>{selected.name}</Text>
          {selected.brand ? (
            <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }}>
              {selected.brand}
            </Text>
          ) : null}
          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
            Per {selected.servingDesc ?? 'serving'}
          </Text>
          <View style={{ flexDirection: 'row', marginTop: 14 }}>
            <MacroBox label="kcal" value={Math.round(selected.calories * mult)} color={colors.accent} />
            <MacroBox label="P" value={Math.round(selected.proteinG * mult)} color={colors.good} />
            <MacroBox label="C" value={Math.round(selected.carbsG * mult)} color={colors.info} />
            <MacroBox label="F" value={Math.round(selected.fatG * mult)} color={colors.warn} />
          </View>
        </View>

        <Field
          label="Servings"
          value={servings}
          onChangeText={setServings}
          keyboardType="decimal-pad"
          placeholder="1"
        />

        <Pressable
          onPress={() => save(selected, selected.barcode ? 'barcode' : 'search')}
          style={{
            backgroundColor: colors.accent,
            borderRadius: radius.md,
            paddingVertical: 16,
            alignItems: 'center',
            marginTop: 6,
          }}>
          <Text style={{ color: colors.onAccent, fontSize: 16, fontWeight: '800' }}>Add to log</Text>
        </Pressable>
        <Pressable onPress={() => setSelected(null)} style={{ alignItems: 'center', paddingVertical: 16 }}>
          <Text style={{ color: colors.textMuted, fontSize: 14, fontWeight: '700' }}>Back to search</Text>
        </Pressable>
      </ModalShell>
    );
  }

  // ---------- Search / scan / manual ----------
  return (
    <ModalShell title="Log Food">
      <MealPicker meal={meal} onChange={setMeal} />

      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
        <Pressable
          onPress={() => router.push('/log/scan')}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surfaceAlt,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.md,
            paddingVertical: 14,
          }}>
          <Ionicons name="barcode-outline" size={18} color={colors.accent} style={{ marginRight: 8 }} />
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>Scan barcode</Text>
        </Pressable>
        <Pressable
          onPress={() => setManual(true)}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surfaceAlt,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.md,
            paddingVertical: 14,
          }}>
          <Ionicons name="create-outline" size={18} color={colors.accent} style={{ marginRight: 8 }} />
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>Manual</Text>
        </Pressable>
      </View>

      <Field
        label="Search foods"
        value={query}
        onChangeText={setQuery}
        placeholder="e.g. banana, clif bar, greek yogurt"
        autoCapitalize="none"
        autoFocus
      />

      {searching ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 12 }} />
      ) : null}

      {results.map((item, i) => (
        <Pressable
          key={`${item.name}-${i}`}
          onPress={() => {
            setServings('1');
            setSelected(item);
          }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }} numberOfLines={1}>
              {item.brand ? `${item.brand} · ` : ''}
              {item.calories} kcal · {item.proteinG}P {item.carbsG}C {item.fatG}F
            </Text>
          </View>
          <Ionicons name="add-circle" size={22} color={colors.accent} />
        </Pressable>
      ))}

      {!searching && query.trim().length >= 2 && results.length === 0 ? (
        <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 14 }}>
          No matches. Try the barcode scanner or add it manually.
        </Text>
      ) : null}
    </ModalShell>
  );
}

function MealPicker({ meal, onChange }: { meal: Meal; onChange: (m: Meal) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 }}>
      {(Object.keys(MEAL_META) as Meal[]).map((m) => (
        <Chip key={m} label={MEAL_META[m].label} selected={meal === m} onPress={() => onChange(m)} />
      ))}
    </View>
  );
}

function MacroBox({ label, value, color }: { label: string; value: number; color: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ color, fontSize: 18, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

function ManualEntry({
  meal,
  onMeal,
  onCancel,
  onSave,
}: {
  meal: Meal;
  onMeal: (m: Meal) => void;
  onCancel: () => void;
  onSave: (item: FoodItem, method: 'manual') => void;
}) {
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [p, setP] = useState('');
  const [c, setC] = useState('');
  const [f, setF] = useState('');
  const valid = name.trim().length > 0 && parseFloat(kcal) > 0;

  return (
    <ModalShell title="Manual Entry">
      <MealPicker meal={meal} onChange={onMeal} />
      <Field label="Food name" value={name} onChangeText={setName} placeholder="e.g. Homemade smoothie" autoFocus />
      <Field label="Calories" value={kcal} onChangeText={setKcal} keyboardType="number-pad" placeholder="350" />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Field label="Protein (g)" value={p} onChangeText={setP} keyboardType="number-pad" placeholder="20" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Carbs (g)" value={c} onChangeText={setC} keyboardType="number-pad" placeholder="40" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Fat (g)" value={f} onChangeText={setF} keyboardType="number-pad" placeholder="10" />
        </View>
      </View>
      <Pressable
        onPress={() =>
          valid &&
          onSave(
            {
              name: name.trim(),
              calories: Math.round(parseFloat(kcal) || 0),
              proteinG: Math.round(parseFloat(p) || 0),
              carbsG: Math.round(parseFloat(c) || 0),
              fatG: Math.round(parseFloat(f) || 0),
            },
            'manual'
          )
        }
        disabled={!valid}
        style={{
          backgroundColor: valid ? colors.accent : colors.surfaceAlt,
          borderRadius: radius.md,
          paddingVertical: 16,
          alignItems: 'center',
          marginTop: 6,
        }}>
        <Text style={{ color: valid ? colors.onAccent : colors.textMuted, fontSize: 16, fontWeight: '800' }}>
          Add to log
        </Text>
      </Pressable>
      <Pressable onPress={onCancel} style={{ alignItems: 'center', paddingVertical: 16 }}>
        <Text style={{ color: colors.textMuted, fontSize: 14, fontWeight: '700' }}>Back</Text>
      </Pressable>
    </ModalShell>
  );
}
