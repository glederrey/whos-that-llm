"use client";

import { deleteCategory } from "@/app/admin/actions";

export function DeleteCategoryForm({ id, name }: { id: string; name: string }) {
  return (
    <form
      action={deleteCategory}
      className="category-delete"
      onSubmit={(event) => {
        if (!window.confirm(`Delete ${name}?`)) event.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button className="button-danger" type="submit">
        Delete
      </button>
    </form>
  );
}
