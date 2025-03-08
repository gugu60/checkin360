import React from 'react';

const PieChartComponent = ({ ritardi = [] }) => {
  const motivazioniMap = {
    "Personale*": ["P*"],
    Personale: ["P"],
    Trasporto: ["T"],
    Malattia: ["M"],
    Sport: ["S"],
  };

  const totaleRitardi = ritardi.length;

  const suddivisione = Object.keys(motivazioniMap).map((motivazione) => ({
    motivazione,
    count: ritardi.filter((r) =>
      motivazioniMap[motivazione].includes(r.motivazione?.trim())
    ).length,
  }));

  const COLORS = ['#FF0000', '#0088FE', '#00C49F', '#FFBB28', '#FF8042']; // Colore rosso per Personale*

  return (
    <div>
      <p className="text-xs text-gray-600 mb-1">
        Totale ritardi: <span className="font-bold">{totaleRitardi}</span>
      </p>
      <div className="grid grid-cols-[90px_auto] gap-y-0.5">
        {suddivisione.map(({ motivazione, count }, index) => (
          <React.Fragment key={index}>
            <p className="text-xs font-medium text-gray-600">{motivazione}:</p>
            <div className="flex items-center">
              <div className="flex-grow bg-gray-200 h-2 rounded-md overflow-hidden">
                <div
                  style={{
                    width: `${totaleRitardi > 0 ? (count / totaleRitardi) * 100 : 0}%`,
                    backgroundColor: COLORS[index % COLORS.length],
                  }}
                  className="h-2"
                />
              </div>
              <span className="ml-2 text-xs font-medium text-gray-600">{count}</span>
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default PieChartComponent;
