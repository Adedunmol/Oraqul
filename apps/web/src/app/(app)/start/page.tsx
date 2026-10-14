import { categorySchema, startModeSchema } from '@oraqul/schema';
import { getViewer } from '@/lib/api/viewer';
import { startPath } from '@/lib/routes';
import { StartScreen } from './start-screen';

export default async function StartPage({ searchParams }: PageProps<'/start'>) {
  const query = await searchParams;
  const parsedMode = startModeSchema.safeParse(query.mode);
  const mode = parsedMode.success ? parsedMode.data : 'start';
  const parsedCategory = categorySchema.safeParse(query.category);
  const category = parsedCategory.success ? parsedCategory.data : undefined;
  const viewer = await getViewer(startPath(mode, category));
  return <StartScreen mode={mode} category={category} viewer={viewer} />;
}
