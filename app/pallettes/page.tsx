import { AVAILABLE_PALETTES } from '@/constants/palettes';

export default async function Page() {
  return (
    <ul className="grid grid-cols-3 gap-8">
      {Object.entries(AVAILABLE_PALETTES).map(([key, value]) => {
        return (
          <li key={key}>
            <h2 className="font-bold">{value.name}</h2>
            {Object.entries(value.coreColors).map(([colorKey, colorValue]) => {
              return (
                <div key={colorKey} className="grid grid-cols-3 gap-4">
                  <div>{colorKey}</div>
                  <div>{colorValue}</div>
                  <div
                    className="size-8 border-2"
                    style={{ backgroundColor: colorValue }}
                  />
                </div>
              );
            })}
          </li>
        );
      })}
    </ul>
  );
}
