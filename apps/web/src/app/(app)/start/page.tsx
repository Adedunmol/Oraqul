import { categorySchema, startModeSchema } from '@oraqul/schema';
import { getViewer } from '@/lib/api/viewer';
import { startPath } from '@/lib/routes';
import { StartScreen } from './start-screen';

const MAX_TEXT = 6000;

export default async function StartPage({ searchParams }: PageProps<'/start'>) {
  const query = await searchParams;
  const parsedMode = startModeSchema.safeParse(query.mode);
  const mode = parsedMode.success ? parsedMode.data : undefined;
  const parsedCategory = categorySchema.safeParse(query.category);
  const category = parsedCategory.success ? parsedCategory.data : undefined;
  // A brief handed over by the guide. Long text stays out of the sign-in return path.
  const text = typeof query.text === 'string' ? query.text.slice(0, MAX_TEXT) : undefined;
  const viewer = await getViewer(startPath({ mode, category, text }));
  return <StartScreen mode={mode} category={category} text={text} viewer={viewer} />;
}
