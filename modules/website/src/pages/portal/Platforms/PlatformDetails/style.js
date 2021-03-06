const styles = {
  selected_platform_title_wrap: {
    'text-align': 'center',
    display: 'grid',
    'grid-template-columns': '10fr 1fr',
    '& h1': {
      'margin-bottom': 0
    },
    '& span': {
      'font-size': '0.8rem'
    },
    '& button': {
      height: 'max-content',
      'margin-top': '1.3rem'
    }
  },
  selected_platform_description: {
    'text-align': 'center',
    margin: '3em'
  },
  notice_card_root: {
    display: 'flex',
    'align-items': 'flex-end',
    'justify-content': 'center',
    'background-color': '#9998ce'
  },
  notice_icon: {
    'margin-right': '1%'
  },
  edit_controls: {
    display: 'grid',
    'grid-auto-flow': 'column'
  },
  title_edit_input: {
    padding: '10px',
    'text-align': 'center',
    'font-size': '2em'
  },
  save_platform: {
    '& > *': {
      'pointer-events': 'none'
    }
  },
  editable_text_wrapper: {
    'justify-content': 'center',
    display: 'grid'
  }
}
export default () => ({
  ...styles,
  textfield: {
    ...styles.selected_platform_description,
    'justify-self': 'center',
    display: 'grid',
    width: '100%'
  }
})
