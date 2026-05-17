import os
import re
import psycopg2

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": os.getenv("DB_PORT", "5432"),
    "database": os.getenv("DB_NAME", "steam_recomendador"),
    "user": os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", "pokemonblack2"),
}


def conectar():
    return psycopg2.connect(**DB_CONFIG)


def normalizar_lista(valor):
    if not valor:
        return set()

    if isinstance(valor, list):
        return {str(v).lower().strip() for v in valor if str(v).strip()}

    texto = str(valor).lower()

    for char in ["{", "}", "[", "]", '"', "'"]:
        texto = texto.replace(char, "")

    partes = re.split(r",|;|\|", texto)

    return {p.strip() for p in partes if p.strip()}


def obtener_juego(app_id):
    conn = conectar()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT
            f.steam_app_id,
            f.nombre,
            f.generos_texto,
            f.categorias_texto,
            j.tags,
            f.texto_consolidado
        FROM features_juegos f
        LEFT JOIN juegos j
            ON j.steam_app_id = f.steam_app_id
        WHERE f.steam_app_id = %s
        """,
        (app_id,),
    )

    row = cur.fetchone()
    cur.close()
    conn.close()

    return row


def comparar(base_id, candidato_id):
    base = obtener_juego(base_id)
    candidato = obtener_juego(candidato_id)

    if not base or not candidato:
        print("No se encontró uno de los juegos.")
        return

    (
        base_appid,
        base_nombre,
        base_generos,
        base_categorias,
        base_tags,
        base_texto,
    ) = base

    (
        cand_appid,
        cand_nombre,
        cand_generos,
        cand_categorias,
        cand_tags,
        cand_texto,
    ) = candidato

    base_tags_set = normalizar_lista(base_tags)
    cand_tags_set = normalizar_lista(cand_tags)

    base_gen_set = normalizar_lista(base_generos)
    cand_gen_set = normalizar_lista(cand_generos)

    base_cat_set = normalizar_lista(base_categorias)
    cand_cat_set = normalizar_lista(cand_categorias)

    print("\n==============================")
    print("JUEGO BASE")
    print("==============================")
    print(f"{base_appid} - {base_nombre}")
    print("\nGéneros:", base_generos)
    print("\nCategorías:", base_categorias)
    print("\nTags:", sorted(base_tags_set))
    print("\nTexto consolidado:")
    print(base_texto[:1200])

    print("\n\n==============================")
    print("CANDIDATO")
    print("==============================")
    print(f"{cand_appid} - {cand_nombre}")
    print("\nGéneros:", cand_generos)
    print("\nCategorías:", cand_categorias)
    print("\nTags:", sorted(cand_tags_set))
    print("\nTexto consolidado:")
    print(cand_texto[:1200])

    print("\n\n==============================")
    print("COMPARACIÓN")
    print("==============================")

    print("\nGéneros en común:")
    print(sorted(base_gen_set & cand_gen_set))

    print("\nCategorías en común:")
    print(sorted(base_cat_set & cand_cat_set))

    print("\nTags en común:")
    print(sorted(base_tags_set & cand_tags_set))

    print("\nTags solo del juego base:")
    print(sorted(base_tags_set - cand_tags_set))

    print("\nTags solo del candidato:")
    print(sorted(cand_tags_set - base_tags_set))


if __name__ == "__main__":
    # Counter-Strike vs candidato
    comparar(10, 18600)