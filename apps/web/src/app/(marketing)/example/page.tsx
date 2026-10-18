import { redirect } from 'next/navigation';

// Old links to /example still land on /examples.
export default function Example(): never {
  redirect('/examples');
}
