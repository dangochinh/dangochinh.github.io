import React from 'react';
import clsx from 'clsx';

// Color mapping for ticket backgrounds
const colorMap = {
    'Red': 'bg-red-500/50',
    'Orange': 'bg-orange-500/50',
    'Purple': 'bg-purple-500/50',
    'Pink': 'bg-pink-500/50',
    'Yellow': 'bg-yellow-500/50',
    'Blue': 'bg-blue-500/50',
    'Lime': 'bg-lime-500/50',
    'Lime Green': 'bg-lime-500/50',
    'Green': 'bg-green-500/50',
};

const Ticket = ({ data, markedNumbers = [], onNumberClick, color }) => {
    // data is 3x9 grid
    const bgColor = colorMap[color] || 'bg-white';

    if (!Array.isArray(data)) return <div className="p-4 text-red-500 bg-white rounded">Invalid Ticket Data</div>;

    return (
        <div className={clsx("border-2 border-slate-700 text-slate-900 mb-4 p-2 rounded-lg shadow-lg max-w-2xl mx-auto", bgColor)}>
            <div className="flex flex-col gap-1">
                {data.map((row, rIdx) => (
                    <div key={rIdx} className="grid grid-cols-9 gap-1 h-12">
                        {Array.isArray(row) && row.map((num, cIdx) => {
                            const isMarked = markedNumbers.includes(num) && num !== 0;
                            return (
                                <div
                                    key={`${rIdx}-${cIdx}`}
                                    onClick={() => num !== 0 && onNumberClick && onNumberClick(num)}
                                    className={clsx(
                                        "flex items-center justify-center font-bold text-lg rounded select-none transition-colors border",
                                        num === 0 ? "invisible border-none" : "border-slate-300 cursor-pointer",
                                        isMarked ? "bg-red-500 text-white border-red-600 scale-105" : "bg-white/80 hover:bg-white"
                                    )}
                                >
                                    {num !== 0 ? num : ''}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Ticket;
