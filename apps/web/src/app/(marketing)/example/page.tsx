import { redirect } from 'next/navigation';

// The page was renamed to /examples when it grew to three cases. Old links still land.
export default function Example(): never {
  redirect('/examples');
}
