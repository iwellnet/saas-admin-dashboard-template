import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { callAdminFunction } from "@/lib/api";

type Org = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  is_active: boolean;
  trial_ends_at: string | null;
  created_at: string;
  user_count: number;
};

type ListResponse = {
  items: Org[];
  total: number;
  page: number;
  pageSize: number;
};

const PAGE_SIZE = 50;

const planVariant: Record<string, "default" | "secondary" | "destructive" | "warning" | "success"> = {
  trial: "warning",
  basic: "secondary",
  pro: "success",
  expired: "destructive",
};

export function Organizations() {
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState<string>("");
  const [page, setPage] = useState(0);

  const { data, isLoading, error } = useQuery({
    queryKey: ["orgs", { search, planFilter, page }],
    queryFn: () =>
      callAdminFunction<ListResponse>("superadmin-list-orgs", {
        query: {
          ...(search && { search }),
          ...(planFilter && { plan: planFilter }),
          page: String(page),
          pageSize: String(PAGE_SIZE),
        },
      }),
  });

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  return (
    <div className="p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Организации</h2>
        <p className="text-muted-foreground">Все клиенты SaaS</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по name или slug…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="pl-9"
          />
        </div>

        <div className="flex gap-1">
          {["", "trial", "basic", "pro", "expired"].map((p) => (
            <Button
              key={p || "all"}
              size="sm"
              variant={planFilter === p ? "default" : "outline"}
              onClick={() => {
                setPlanFilter(p);
                setPage(0);
              }}
            >
              {p || "Все"}
            </Button>
          ))}
        </div>
      </div>

      {error && (
        <Card className="p-4 text-destructive">
          Ошибка загрузки: {(error as Error).message}
        </Card>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>План</TableHead>
              <TableHead>Активна</TableHead>
              <TableHead>Пользователи</TableHead>
              <TableHead>Trial до</TableHead>
              <TableHead>Регистрация</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Загрузка…
                </TableCell>
              </TableRow>
            ) : !data?.items.length ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Организаций не найдено
                </TableCell>
              </TableRow>
            ) : (
              data.items.map((org) => (
                <TableRow key={org.id} className="cursor-pointer">
                  <TableCell className="font-medium">{org.name}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{org.slug}</TableCell>
                  <TableCell>
                    <Badge variant={planVariant[org.plan] || "outline"}>{org.plan}</Badge>
                  </TableCell>
                  <TableCell>
                    {org.is_active ? (
                      <Badge variant="success">Да</Badge>
                    ) : (
                      <Badge variant="destructive">Нет</Badge>
                    )}
                  </TableCell>
                  <TableCell>{org.user_count}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {org.trial_ends_at
                      ? new Date(org.trial_ends_at).toLocaleDateString("ru-RU")
                      : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(org.created_at).toLocaleDateString("ru-RU")}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {data && totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <div className="text-muted-foreground">
            Страница {page + 1} из {totalPages} · всего {data.total}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
              Назад
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Вперёд
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
