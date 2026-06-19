from pydantic import BaseModel, model_validator


# These mirror the frontend BoardData shape in frontend/src/lib/kanban.ts.
class Card(BaseModel):
    id: str
    title: str
    details: str


class Column(BaseModel):
    id: str
    title: str
    cardIds: list[str]


class BoardData(BaseModel):
    columns: list[Column]
    cards: dict[str, Card]

    @model_validator(mode="after")
    def card_refs_exist(self) -> "BoardData":
        for col in self.columns:
            for cid in col.cardIds:
                if cid not in self.cards:
                    raise ValueError(f"Column '{col.id}' references unknown card '{cid}'")
        return self
