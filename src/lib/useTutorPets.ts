import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { matchesSearch } from "@/lib/search";

/** Active pet names grouped by tutor, so client searches can also match pet names. */
export function useTutorPets(enabled = true) {
  const pets = useQuery({
    queryKey: ["pets", "all-names"],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("pets").select("tutor_id, name").eq("is_active", true).limit(10000);
      if (error) throw error;
      return (data ?? []) as Array<{ tutor_id: string; name: string }>;
    },
  });

  const byTutor = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const p of pets.data ?? []) {
      const list = map.get(p.tutor_id) ?? [];
      list.push(p.name);
      map.set(p.tutor_id, list);
    }
    return map;
  }, [pets.data]);

  const petNamesOf = useCallback((tutorId: string) => byTutor.get(tutorId) ?? [], [byTutor]);
  const matchingPets = useCallback(
    (tutorId: string, term: string) => (term.trim() ? (byTutor.get(tutorId) ?? []).filter((n) => matchesSearch(n, term)) : []),
    [byTutor],
  );

  return { petNamesOf, matchingPets };
}
