import React, { useEffect, useState } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import { stringToJexlExpression } from '@jbrowse/core/util/jexlStrings'
import { Button, DialogActions, DialogContent, TextField } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

const useStyles = makeStyles()({
  dialogContent: {
    width: '80em',
  },
  textAreaFont: {
    fontFamily: 'Courier New',
  },

  error: {
    color: 'red',
    fontSize: '0.8em',
  },
})

const AddFiltersDialog = observer(function ({
  model,
  handleClose,
}: {
  model: {
    jexlFilters?: string[]
    activeFilters: string[]
    setJexlFilters: (arg?: string[]) => void
  }
  handleClose: () => void
}) {
  const { classes } = useStyles()
  const { activeFilters } = model
  const [data, setData] = useState(
    activeFilters
      .filter(Boolean)
      .map(f => f.replace(/^jexl:/, ''))
      .join('\n'),
  )
  const [error, setError] = useState<unknown>()

  useEffect(() => {
    try {
      for (const line of data.split('\n')) {
        const trimmed = line.trim()
        if (trimmed) {
          stringToJexlExpression(trimmed)
        }
      }
      setError(undefined)
    } catch (e) {
      console.error(e)
      setError(e)
    }
  }, [data])

  return (
    <Dialog maxWidth="xl" open onClose={handleClose} title="Add track filters">
      <DialogContent>
        <div>
          Add filters, in jexl format, one per line, starting with the string
          jexl:. Examples:{' '}
          <ul>
            <li>
              <code>jexl:get(feature,'name')=='BRCA1'</code> - show only feature
              where the name attribute is BRCA1
            </li>
            <li>
              <code>jexl:get(feature,'type')=='gene'</code> - show only gene
              type features in a GFF that has many other feature types
            </li>
            <li>
              <code>jexl:get(feature,'score') &gt; 400</code> - show only
              features that have a score greater than 400
            </li>
          </ul>
        </div>

        {error ? (
          <p className={classes.error}>
            {error instanceof Error ? error.message : String(error)}
          </p>
        ) : null}
        <TextField
          variant="outlined"
          multiline
          minRows={5}
          maxRows={10}
          className={classes.dialogContent}
          fullWidth
          value={data}
          onChange={event => {
            setData(event.target.value)
          }}
          slotProps={{
            input: {
              classes: {
                input: classes.textAreaFont,
              },
            },
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          color="primary"
          type="submit"
          autoFocus
          disabled={!!error}
          onClick={() => {
            model.setJexlFilters(
              data
                .split('\n')
                .map(f => f.trim())
                .filter(f => f)
                .map(f => (f.startsWith('jexl:') ? f : `jexl:${f}`)),
            )
            handleClose()
          }}
        >
          Submit
        </Button>
        <Button variant="contained" color="secondary" onClick={handleClose}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
})

export default AddFiltersDialog
