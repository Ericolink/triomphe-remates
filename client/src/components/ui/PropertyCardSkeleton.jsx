const shimmer = 'animate-pulse bg-gray-200 dark:bg-[#2e3650]';

export default function PropertyCardSkeleton() {
  return (
    <div className="bg-white dark:bg-[#242938] rounded-2xl overflow-hidden shadow-md border border-gray-100 dark:border-[#2e3650]">
      <div className={`h-52 ${shimmer}`} />
      <div className="p-5 space-y-3">
        <div className={`h-7 w-32 rounded-lg ${shimmer}`} />
        <div className={`h-5 w-4/5 rounded-lg ${shimmer}`} />
        <div className={`h-4 w-24 rounded-lg ${shimmer}`} />
        <div className="flex gap-3 border-t border-gray-100 dark:border-[#2e3650] pt-3">
          <div className={`h-4 w-20 rounded-lg ${shimmer}`} />
          <div className={`h-4 w-16 rounded-lg ${shimmer}`} />
          <div className={`h-4 w-16 rounded-lg ${shimmer}`} />
        </div>
      </div>
    </div>
  );
}

export function PropertyCardSkeletonGrid({ count = 6, className = '' }) {
  return (
    <div className={className}>
      {Array.from({ length: count }, (_, i) => (
        <PropertyCardSkeleton key={i} />
      ))}
    </div>
  );
}
