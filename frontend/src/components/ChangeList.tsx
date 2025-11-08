import { Change } from '../types';
import { ChangeCard } from './ChangeCard';
import { useState } from 'react';

interface ChangeListProps {
  changes: Change[];
  onAccept: (changeId: string) => void;
  onDecline: (changeId: string) => void;
  onInstruction: (changeId: string, instruction: string) => void;
}

export function ChangeList({ changes, onAccept, onDecline, onInstruction }: ChangeListProps) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'declined'>('all');

  const filteredChanges = changes.filter(change => {
    if (filter === 'all') return true;
    return change.status === filter;
  });

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1 rounded ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
        >
          All ({changes.length})
        </button>
        <button
          onClick={() => setFilter('pending')}
          className={`px-3 py-1 rounded ${filter === 'pending' ? 'bg-yellow-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
        >
          Pending ({changes.filter(c => c.status === 'pending').length})
        </button>
        <button
          onClick={() => setFilter('accepted')}
          className={`px-3 py-1 rounded ${filter === 'accepted' ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
        >
          Accepted ({changes.filter(c => c.status === 'accepted').length})
        </button>
        <button
          onClick={() => setFilter('declined')}
          className={`px-3 py-1 rounded ${filter === 'declined' ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
        >
          Declined ({changes.filter(c => c.status === 'declined').length})
        </button>
      </div>

      {filteredChanges.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          {filter === 'all' ? 'No changes yet' : `No ${filter} changes`}
        </div>
      ) : (
        <div>
          {filteredChanges.map(change => (
            <ChangeCard
              key={change.id}
              change={change}
              onAccept={onAccept}
              onDecline={onDecline}
              onInstruction={onInstruction}
            />
          ))}
        </div>
      )}
    </div>
  );
}
