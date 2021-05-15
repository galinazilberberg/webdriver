describe('webdriver.io page', () => {
    it('should have the right title', () => {
        $('foobar').click()
        $('foobar').$('foobar').$$('foobar')[123].click()

        const elem = $('foobar')
        elem.dragAndDrop($('barfoo'))

        const texts = $$('div').map((div) => div.getText())
        const elemWithText = $$('div').find((div) => div.getText() === 'foobar')
    })
})
