import { useState, useEffect } from "react";
import {
  getStatsOverview,
  getRepoCountByLanguage,
  getTagDistribution,
  getStarsHistogram,
  getMonthlyStarred,
  StatsOverview,
  LangCount,
  TagCount,
  StarsBucket,
  MonthlyCount,
} from "@/lib/commands";
import { Star, Tag, Code2, StickyNote, TrendingUp, Loader2 } from "lucide-react";
import { formatNumber } from "@/lib/utils";

export function Dashboard() {
  const [overview, setOverview] = useState<StatsOverview | null>(null);
  const [languages, setLanguages] = useState<LangCount[]>([]);
  const [tagDist, setTagDist] = useState<TagCount[]>([]);
  const [starsBuckets, setStarsBuckets] = useState<StarsBucket[]>([]);
  const [monthly, setMonthly] = useState<MonthlyCount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [ov, langs, tags, stars, mon] = await Promise.all([
          getStatsOverview(),
          getRepoCountByLanguage(),
          getTagDistribution(),
          getStarsHistogram(),
          getMonthlyStarred(),
        ]);
        setOverview(ov);
        setLanguages(langs);
        setTagDist(tags);
        setStarsBuckets(stars);
        setMonthly(mon);
      } catch (err) {
        console.error("Failed to load stats:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="text-sm">加载统计数据...</p>
        </div>
      </div>
    );
  }

  if (!overview) return null;

  const maxLangCount = languages.length > 0 ? languages[0].count : 1;
  const maxTagCount = tagDist.length > 0 ? Math.max(...tagDist.map((t) => t.count)) : 1;
  const maxStarsBucket = starsBuckets.length > 0 ? Math.max(...starsBuckets.map((b) => b.count)) : 1;
  const maxMonthly = monthly.length > 0 ? Math.max(...monthly.map((m) => m.count)) : 1;

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <h2 className="text-xl font-semibold">统计面板</h2>

        {/* 概览卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={<Star className="w-4 h-4 text-yellow-500" />}
            label="收藏仓库"
            value={formatNumber(overview.total_repos)}
          />
          <StatCard
            icon={<Tag className="w-4 h-4 text-indigo-500" />}
            label="标签数"
            value={overview.total_tags.toString()}
          />
          <StatCard
            icon={<Code2 className="w-4 h-4 text-cyan-500" />}
            label="语言种类"
            value={overview.total_languages.toString()}
          />
          <StatCard
            icon={<StickyNote className="w-4 h-4 text-amber-500" />}
            label="有笔记"
            value={overview.total_with_notes.toString()}
          />
        </div>

        {/* 额外信息 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 border border-border rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">平均 Stars</p>
            <p className="text-lg font-semibold">{formatNumber(Math.round(overview.avg_stars))}</p>
          </div>
          <div className="p-4 border border-border rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">最高 Stars 仓库</p>
            <p className="text-sm font-medium truncate">{overview.max_stars_repo || "-"}</p>
          </div>
        </div>

        {/* 图表区域 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 语言分布 */}
          <div className="p-4 border border-border rounded-lg">
            <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
              <Code2 className="w-4 h-4" />
              语言分布 Top 10
            </h3>
            <div className="space-y-2">
              {languages.slice(0, 10).map((lang) => (
                <div key={lang.language} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-20 truncate text-right">
                    {lang.language}
                  </span>
                  <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
                    <div
                      className="h-full bg-cyan-500/70 rounded transition-all"
                      style={{ width: `${(lang.count / maxLangCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-8">
                    {lang.count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 标签分布 */}
          <div className="p-4 border border-border rounded-lg">
            <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
              <Tag className="w-4 h-4" />
              标签分布
            </h3>
            {tagDist.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">暂无标签数据</p>
            ) : (
              <div className="space-y-2">
                {tagDist.slice(0, 10).map((tag) => (
                  <div key={tag.name} className="flex items-center gap-2">
                    <span className="text-xs w-20 truncate text-right" style={{ color: tag.color }}>
                      {tag.name}
                    </span>
                    <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
                      <div
                        className="h-full rounded transition-all"
                        style={{
                          width: `${(tag.count / maxTagCount) * 100}%`,
                          backgroundColor: tag.color + "99",
                        }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-8">
                      {tag.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stars 分布 */}
          <div className="p-4 border border-border rounded-lg">
            <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
              <Star className="w-4 h-4" />
              Stars 数量分布
            </h3>
            <div className="flex items-end gap-3 h-40 pt-6">
              {starsBuckets.map((bucket) => (
                <div key={bucket.label} className="flex-1 flex flex-col items-center h-full">
                  <span className="text-xs text-muted-foreground mb-1">{bucket.count}</span>
                  <div className="w-full flex-1 relative">
                    <div className="absolute inset-x-1 bottom-0 bg-yellow-500/70 rounded-t transition-all"
                      style={{
                        height: `${maxStarsBucket > 0 ? (bucket.count / maxStarsBucket) * 100 : 0}%`,
                        minHeight: bucket.count > 0 ? '4px' : '0',
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-1 whitespace-nowrap">{bucket.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 月度收藏趋势 */}
          <div className="p-4 border border-border rounded-lg">
            <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              月度收藏趋势
            </h3>
            {monthly.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">暂无趋势数据</p>
            ) : (
              <div className="flex items-end gap-1 h-40 pt-6">
                {monthly.map((m) => (
                  <div key={m.month} className="flex-1 flex flex-col items-center h-full">
                    <span className="text-[10px] text-muted-foreground mb-1">{m.count}</span>
                    <div className="w-full flex-1 relative">
                      <div className="absolute inset-x-0.5 bottom-0 bg-primary/60 rounded-t transition-all"
                        style={{
                          height: `${maxMonthly > 0 ? (m.count / maxMonthly) * 100 : 0}%`,
                          minHeight: m.count > 0 ? '4px' : '0',
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground mt-1">
                      {m.month.slice(5)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="p-4 border border-border rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
