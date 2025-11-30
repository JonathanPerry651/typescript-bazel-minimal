describe('template spec', () => {
    it('passes', () => {
        cy.visit('/');
        cy.contains('Hello React World. 2 + 3 = 5');
    });
});
