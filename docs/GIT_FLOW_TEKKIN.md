# Tekkin Git Flow

## Branch
- main → branch stabile, sempre funzionante
- dev → branch di lavoro continuo

## Routine quotidiana
1. git checkout dev
2. git pull origin dev
3. sviluppo
4. git status
5. git add .
6. git commit -m "tipo: descrizione"
7. git push origin dev

## Creare un Checkpoint (versione stabile)
1. git checkout main
2. git pull origin main
3. git merge --no-ff dev -m "merge dev in main - stato stabile"
4. git push origin main
5. git tag -a CHECKPOINT_YYYY-MM-DD_HH-MM -m "nota"
6. git push origin main --tags

## Riallineare dev a main (se necessario)
1. git checkout dev
2. git reset --hard main
3. git push origin dev --force

## Ripristinare un Checkpoint
1. git tag
2. git checkout -b rescue-CHECKPOINT_YYYY-MM-DD_HH-MM CHECKPOINT_YYYY-MM-DD_HH-MM
